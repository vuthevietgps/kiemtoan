import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Contract, ContractStatus, Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { paginated, toSkipTake } from '../../../common/types/paginated';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { sumDecimal } from '../contract-calculator';
import { ContractsCommandService } from '../contracts-command.service';
import { scopedContract } from '../contracts-query.service';
import { CreateContractDto } from '../dto/contract.dto';
import { BusinessInfoDto } from '../dto/lifecycle.dto';
import { addDays, addYears, shiftPeriod, vietnamToday } from './renewal.util';

const { NOT_STARTED, IN_PROGRESS, COMPLETED, LIQUIDATED, CANCELLED } =
  ContractStatus;
/** HĐ đã duyệt (kể cả đã thanh lý) mới được tái ký và tính tỷ lệ tái ký. */
const RENEWABLE: ContractStatus[] = [
  NOT_STARTED,
  IN_PROGRESS,
  COMPLETED,
  LIQUIDATED,
];
const ACTIVE_RENEWAL = {
  deletedAt: null,
  status: { not: CANCELLED },
} satisfies Prisma.ContractWhereInput;
/** Lịch sử HĐ chỉ trả các khoá không có số tiền. */
const SAFE_DETAIL_KEYS = [
  'code',
  'newCode',
  'from',
  'to',
  'reason',
  'type',
  'version',
  'templateVersion',
  'number',
  'title',
  'fields',
  'taskCount',
  'method',
  'path',
  // 04-F: hồ sơ kiểm toán (không có số tiền).
  'lineId',
  'reportDate',
];
/**
 * Đường dẫn đã có bản ghi nghiệp vụ riêng (duyệt, phụ lục, tái ký, hồ sơ…): bỏ bản ghi chung của
 * AuditInterceptor cho cùng thao tác để lịch sử không bị lặp.
 */
const LOGGED_SUFFIXES = [
  '/team',
  '/submit',
  '/approve',
  '/return',
  '/cancel',
  '/renew',
  '/business-info',
  '/amendments',
  '/documents/generate',
  '/documents/signed',
  '/dossier',
];
/** Mọi lệnh dưới các đường dẫn này đều tự ghi bản ghi nghiệp vụ (04-F). */
const LOGGED_SEGMENTS = ['/audit-engagements/'];
/** Mã thao tác AuditInterceptor ghi cho mọi request thay đổi/tải file. */
const GENERIC_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'EXPORT'];
const INFO_KEYS = [
  'ownerId',
  'salesOwnerId',
  'referrerName',
  'referrerPhone',
  'referrerNote',
  'signedDate',
  'note',
] as const;

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Vòng đời HĐ (đặc tả 04-D): thông tin kinh doanh sửa được sau duyệt (E5, E6), tái ký sang năm
 * sau, danh sách sắp hết hạn, tỷ lệ tái ký và lịch sử thao tác.
 */
@Injectable()
export class ContractLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly command: ContractsCommandService,
  ) {}

  async updateBusinessInfo(user: AuthUser, id: string, dto: BusinessInfoDto) {
    const before = await this.findScoped(user, id);
    if (before.status === CANCELLED)
      throw new BadRequestException('Hợp đồng đã huỷ, không sửa được');
    await this.ensureUsers([dto.ownerId, dto.salesOwnerId]);
    const data: Prisma.ContractUncheckedUpdateInput = {};
    const changed: string[] = [];
    for (const key of INFO_KEYS) {
      const value = dto[key];
      if (value === undefined) continue;
      const next =
        key === 'signedDate' && value ? new Date(value) : (value ?? null);
      const previous = before[key];
      const same =
        previous instanceof Date && next instanceof Date
          ? previous.getTime() === next.getTime()
          : previous === next;
      if (same) continue;
      Object.assign(data, { [key]: next });
      changed.push(key);
    }
    if (!changed.length) return before;
    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE_INFO',
          entity: 'contracts',
          entityId: id,
          detail: {
            code: contract.code,
            fields: changed,
            before: pick(before, changed),
            after: pick(contract, changed),
          },
        },
      });
      return contract;
    });
  }

  /** "Tạo HĐ năm sau": chép KH, dòng dịch vụ (kỳ +1 năm), người phụ trách, điều khoản; HĐ mới ở Nháp. */
  async renew(user: AuthUser, id: string): Promise<Contract> {
    const source = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id }),
      include: {
        services: true,
        installments: { orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }] },
        renewals: { where: ACTIVE_RENEWAL, select: { code: true } },
      },
    });
    if (!source) throw new NotFoundException('Không tìm thấy hợp đồng');
    if (!RENEWABLE.includes(source.status))
      throw new BadRequestException('Chỉ tái ký hợp đồng đã duyệt');
    if (source.renewals.length)
      throw new ConflictException(
        `Hợp đồng đã được tái ký: ${source.renewals[0].code}`,
      );
    const active = await this.activeUserIds([
      source.ownerId,
      source.salesOwnerId,
      ...source.services.map((s) => s.assigneeId),
    ]);
    const keep = (userId: string | null) =>
      userId && active.has(userId) ? userId : undefined;
    const sameTotal = sumDecimal(source.installments.map((i) => i.amount)).eq(
      source.total,
    );
    const dto: CreateContractDto = {
      customerId: source.customerId,
      ownerId: keep(source.ownerId),
      salesOwnerId: keep(source.salesOwnerId),
      referrerName: source.referrerName,
      referrerPhone: source.referrerPhone,
      referrerNote: source.referrerNote,
      startDate: day(addYears(source.startDate)),
      endDate: source.endDate ? day(addYears(source.endDate)) : null,
      vatRate: source.vatRate.toNumber(),
      note: source.note,
      services: source.services.map((line) => ({
        serviceTypeId: line.serviceTypeId,
        description: line.description ?? undefined,
        period: shiftPeriod(line.period) ?? undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toString(),
        assigneeId: keep(line.assigneeId),
      })),
      installments: sameTotal
        ? source.installments.map((i) => ({
            name: i.name,
            amount: i.amount.toString(),
            dueDate: day(addYears(i.dueDate)),
          }))
        : undefined,
    };
    const created = await this.command.create(user, dto, id);
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'RENEW',
        entity: 'contracts',
        entityId: id,
        detail: { code: source.code, newCode: created.code },
      },
    });
    return created;
  }

  /** HĐ đang hiệu lực hết hạn trong `days` ngày tới, kèm HĐ tái ký nếu đã có. */
  async expiring(user: AuthUser, days = 30) {
    const today = vietnamToday();
    const rows = await this.prisma.contract.findMany({
      where: scopedContract(user, {
        status: { in: [NOT_STARTED, IN_PROGRESS, COMPLETED] },
        endDate: { gte: today, lte: addDays(today, days) },
      }),
      select: {
        id: true,
        code: true,
        status: true,
        endDate: true,
        customer: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
        renewals: {
          where: ACTIVE_RENEWAL,
          select: { id: true, code: true, status: true },
        },
      },
      orderBy: [{ endDate: 'asc' }, { code: 'asc' }],
      take: 200,
    });
    return {
      days,
      items: rows.map((row) => ({
        ...row,
        daysLeft: Math.round(
          (row.endDate!.getTime() - today.getTime()) / 86_400_000,
        ),
      })),
    };
  }

  /** Tỷ lệ tái ký của HĐ đã duyệt hết hạn trong khoảng ngày (để báo cáo 10 dùng). */
  async renewalStats(user: AuthUser, from: string, to: string) {
    if (from > to) throw new BadRequestException('Từ ngày phải trước đến ngày');
    const where = scopedContract(user, {
      status: { in: RENEWABLE },
      endDate: { gte: new Date(from), lte: new Date(to) },
    });
    const [total, renewed] = await this.prisma.$transaction([
      this.prisma.contract.count({ where }),
      this.prisma.contract.count({
        where: { AND: [where, { renewals: { some: ACTIVE_RENEWAL } }] },
      }),
    ]);
    return {
      from,
      to,
      total,
      renewed,
      rate: total ? Math.round((renewed / total) * 10000) / 10000 : null,
    };
  }

  /** Lịch sử thao tác trên HĐ (duyệt, trả lại, phụ lục, kế hoạch, hồ sơ…), không kèm số tiền. */
  async history(user: AuthUser, id: string, query: PaginationQueryDto) {
    await this.findScoped(user, id);
    // Chỉ lọc bản ghi chung (luôn có detail.path); lọc JSON trên bản ghi không có path cho NULL
    // trong SQL nên NOT sẽ loại nhầm cả bản ghi nghiệp vụ.
    const where: Prisma.AuditLogWhereInput = {
      entity: 'contracts',
      entityId: id,
      OR: [
        { action: { notIn: GENERIC_ACTIONS } },
        {
          action: { in: GENERIC_ACTIONS },
          NOT: {
            OR: [
              ...LOGGED_SUFFIXES.map((suffix) => ({
                detail: { path: ['path'], string_ends_with: suffix },
              })),
              ...LOGGED_SEGMENTS.map((segment) => ({
                detail: { path: ['path'], string_contains: segment },
              })),
            ],
          },
        },
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          detail: true,
          createdAt: true,
          user: { select: { id: true, fullName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const items = rows.map((row) => ({
      ...row,
      detail: pick(
        (row.detail ?? {}) as Record<string, unknown>,
        SAFE_DETAIL_KEYS,
      ),
    }));
    return paginated(items, total, query);
  }

  private async findScoped(user: AuthUser, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id }),
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    return contract;
  }

  private async activeUserIds(ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((v): v is string => !!v))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: wanted }, deletedAt: null, isActive: true },
      select: { id: true },
    });
    return new Set(users.map((u) => u.id));
  }

  private async ensureUsers(ids: (string | null | undefined)[]) {
    const wanted = ids.filter((v): v is string => !!v);
    if ((await this.activeUserIds(wanted)).size !== new Set(wanted).size)
      throw new BadRequestException(
        'Người phụ trách không tồn tại hoặc đã nghỉ',
      );
  }
}

function pick(source: object, keys: readonly string[]): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => keys.includes(key)),
  );
}
