import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CredentialEventType, Prisma } from '@prisma/client';
import { customerScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';

export const CONFLICT = 'Tài khoản đã được người khác cập nhật, tải lại để xem';

/** Trường nội bộ dùng khi ghi — có passwordEnc, không bao giờ trả ra API. */
const WRITE_SELECT = {
  id: true,
  customerId: true,
  type: true,
  label: true,
  url: true,
  username: true,
  passwordEnc: true,
  expiresAt: true,
  status: true,
  statusNote: true,
  note: true,
  provider: true,
  serialNumber: true,
  custody: true,
  storageLocation: true,
  holderId: true,
  loanDueAt: true,
  revision: true,
} satisfies Prisma.ClientCredentialSelect;

export type StoredCredential = Prisma.ClientCredentialGetPayload<{
  select: typeof WRITE_SELECT;
}>;

export interface CredentialEventInput {
  type: CredentialEventType;
  note?: string | null;
  detail?: Prisma.InputJsonValue;
}

/**
 * Đọc trong phạm vi KH và ghi có kiểm `revision` + sự kiện (đặc tả 09) — dùng chung cho lệnh tài khoản,
 * token và bí mật để mọi lối ghi cùng một quy tắc 404 / 409 / lịch sử.
 */
@Injectable()
export class CredentialStore {
  constructor(private readonly prisma: PrismaService) {}

  scoped(
    user: AuthUser,
    extra: Prisma.ClientCredentialWhereInput = {},
  ): Prisma.ClientCredentialWhereInput {
    return {
      deletedAt: null,
      customer: { AND: [{ deletedAt: null }, customerScope(user)] },
      ...extra,
    };
  }

  async load(user: AuthUser, id: string): Promise<StoredCredential> {
    const found = await this.prisma.clientCredential.findFirst({
      where: this.scoped(user, { id }),
      select: WRITE_SELECT,
    });
    if (!found) throw new NotFoundException('Không tìm thấy tài khoản');
    return found;
  }

  /** Bản cũ → 409 trước mọi kiểm tra nghiệp vụ (bài học 07-C). */
  async loadForWrite(user: AuthUser, id: string, revision: number) {
    const found = await this.load(user, id);
    if (found.revision !== revision) throw new ConflictException(CONFLICT);
    return found;
  }

  /** Ghi thay đổi khi revision còn khớp, tăng revision và thêm sự kiện trong cùng transaction. */
  async commit(
    user: AuthUser,
    found: StoredCredential,
    data: Prisma.ClientCredentialUncheckedUpdateManyInput,
    events: CredentialEventInput[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.clientCredential.updateMany({
        where: { id: found.id, revision: found.revision, deletedAt: null },
        data: {
          ...data,
          revision: { increment: 1 },
          updatedById: user.id,
        },
      });
      if (!count) throw new ConflictException(CONFLICT);
      await this.addEvents(tx, found.id, user.id, events);
    });
  }

  async addEvents(
    db: Prisma.TransactionClient,
    credentialId: string,
    actorId: string,
    events: CredentialEventInput[],
  ): Promise<void> {
    if (!events.length) return;
    await db.credentialEvent.createMany({
      data: events.map((e) => ({
        credentialId,
        actorId,
        type: e.type,
        note: e.note ?? null,
        detail: e.detail,
      })),
    });
  }

  /** L2: trùng serial cùng nhà cung cấp giữa các token chưa xoá → 409. */
  async ensureUniqueSerial(
    provider: StoredCredential['provider'],
    serialNumber: string | null,
    exceptId?: string,
  ): Promise<void> {
    if (!provider || !serialNumber) return;
    const duplicate = await this.prisma.clientCredential.findFirst({
      where: {
        provider,
        serialNumber,
        deletedAt: null,
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (duplicate)
      throw new ConflictException('Số serial token này đã có trong kho');
  }
}

/** Lỗi ràng buộc duy nhất (chỉ mục serial) khi hai người lưu cùng lúc → 409 như kiểm tra trước. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
