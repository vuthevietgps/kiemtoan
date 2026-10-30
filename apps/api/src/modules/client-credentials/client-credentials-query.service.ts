import { Injectable, NotFoundException } from '@nestjs/common';
import { CredentialType, Prisma, TokenCustody } from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { addDays, todayVn } from '../reports/utils/period.util';
import { CredentialStore } from './credential-store';
import {
  ACCESS_EVENTS,
  daysUntil,
  EXPIRY_WARNING_DAYS,
} from './credential.rules';
import { ClientCredentialQueryDto } from './dto/client-credential.dto';

/** Trường được phép trả ra ngoài — tuyệt đối không có passwordEnc. */
export const CREDENTIAL_PUBLIC_SELECT = {
  id: true,
  customerId: true,
  type: true,
  label: true,
  url: true,
  username: true,
  expiresAt: true,
  status: true,
  statusNote: true,
  note: true,
  provider: true,
  serialNumber: true,
  custody: true,
  storageLocation: true,
  holderId: true,
  loanedAt: true,
  loanDueAt: true,
  loanPurpose: true,
  secretChangedAt: true,
  secretChangedById: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, taxCode: true } },
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ClientCredentialSelect;

type PublicRow = Prisma.ClientCredentialGetPayload<{
  select: typeof CREDENTIAL_PUBLIC_SELECT;
}>;
type Person = { id: string; fullName: string };

/**
 * Đọc kho tài khoản (đặc tả 09): danh sách theo tab / bộ lọc, chi tiết + lịch sử (L8), nhật ký xem/sao
 * chép (L8, quyền `update`). Có mật khẩu hay không chỉ trả cờ `hasSecret`, không bao giờ trả bản mã.
 */
@Injectable()
export class ClientCredentialsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: CredentialStore,
  ) {}

  async findAll(user: AuthUser, query: ClientCredentialQueryDto) {
    const where = this.store.scoped(user, { AND: this.filters(query) });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.clientCredential.findMany({
        where,
        select: CREDENTIAL_PUBLIC_SELECT,
        orderBy: [{ customer: { name: 'asc' } }, { type: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.clientCredential.count({ where }),
    ]);
    return paginated(await this.present(rows), total, query);
  }

  async findOne(user: AuthUser, id: string) {
    const row = await this.prisma.clientCredential.findFirst({
      where: this.store.scoped(user, { id }),
      select: CREDENTIAL_PUBLIC_SELECT,
    });
    if (!row) throw new NotFoundException('Không tìm thấy tài khoản');
    const [item] = await this.present([row]);
    const history = await this.events(id, { notIn: ACCESS_EVENTS });
    return { ...item, history };
  }

  /** Nhật ký xem / sao chép (L6, L8): ai, lúc nào, loại — không có bí mật. */
  async accessLog(user: AuthUser, id: string) {
    await this.store.load(user, id);
    return { items: await this.events(id, { in: ACCESS_EVENTS }) };
  }

  private filters(q: ClientCredentialQueryDto) {
    const today = todayVn();
    const and: Prisma.ClientCredentialWhereInput[] = [
      { customerId: q.customerId, type: q.type, status: q.status },
      { custody: q.custody, holderId: q.holderId },
    ];
    if (q.kind === 'TOKEN')
      and.push({ type: CredentialType.DIGITAL_SIGNATURE });
    if (q.kind === 'ACCOUNT')
      and.push({ type: { not: CredentialType.DIGITAL_SIGNATURE } });
    if (q.expiring)
      and.push({ expiresAt: { lte: addDays(today, EXPIRY_WARNING_DAYS) } });
    if (q.overdueLoan)
      and.push({ custody: TokenCustody.LOANED, loanDueAt: { lt: today } });
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      and.push({
        OR: [
          { username: contains },
          { label: contains },
          { serialNumber: contains },
          { customer: { name: contains } },
          { customer: { taxCode: contains } },
        ],
      });
    }
    return and;
  }

  /** Thêm tên người giữ / người đổi mật khẩu, cờ có bí mật, số ngày còn hạn, mượn quá hạn. */
  private async present(rows: PublicRow[]) {
    const secrets = await this.prisma.clientCredential.findMany({
      where: { id: { in: rows.map((r) => r.id) }, passwordEnc: { not: null } },
      select: { id: true },
    });
    const withSecret = new Set(secrets.map((s) => s.id));
    const people = await this.people(
      rows.flatMap((r) => [r.holderId, r.secretChangedById]),
    );
    const today = todayVn();
    return rows.map(({ holderId, secretChangedById, ...row }) => ({
      ...row,
      hasSecret: withSecret.has(row.id),
      holder: holderId ? (people.get(holderId) ?? null) : null,
      secretChangedBy: secretChangedById
        ? (people.get(secretChangedById) ?? null)
        : null,
      daysToExpiry: daysUntil(row.expiresAt, today),
      loanOverdue:
        row.custody === TokenCustody.LOANED &&
        !!row.loanDueAt &&
        row.loanDueAt < today,
    }));
  }

  private async events(
    credentialId: string,
    type: Prisma.EnumCredentialEventTypeFilter,
  ) {
    const rows = await this.prisma.credentialEvent.findMany({
      where: { credentialId, type },
      orderBy: { occurredAt: 'desc' },
      take: 200,
      select: {
        id: true,
        type: true,
        actorId: true,
        note: true,
        detail: true,
        occurredAt: true,
      },
    });
    const people = await this.people(rows.map((r) => r.actorId));
    return rows.map(({ actorId, ...e }) => ({
      ...e,
      actor: actorId ? (people.get(actorId) ?? null) : null,
    }));
  }

  private async people(ids: (string | null)[]): Promise<Map<string, Person>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (!unique.length) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }
}
