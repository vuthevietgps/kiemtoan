import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractStatus,
  DocumentCategory,
  ObligationStatus,
  ObligationVersionStatus,
  Prisma,
} from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import { customerScope } from '../../core/access-control/data-scope';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { UploadedFileInfo } from '../../core/storage/storage.service';
import { DocumentsService } from '../documents/documents.service';
import {
  formatBusinessDate,
  todayVn,
  toBusinessDate,
} from '../reports/utils/period.util';
import {
  FileObligationDto,
  ObligationActionDto,
  ObligationQueryDto,
  ObligationReasonDto,
  ObligationSettingDto,
  ObligationSummaryQueryDto,
} from './dto/deadlines.dto';
import { ObligationEngine } from './obligation-engine.service';

const { NOT_DUE, PREPARING, FILED, NOT_APPLICABLE } = ObligationStatus;
const OPEN: ObligationStatus[] = [NOT_DUE, PREPARING];
const CONFLICT =
  'Nghĩa vụ vừa được người khác cập nhật; vui lòng tải lại để xem trạng thái mới';

const LIST_INCLUDE = {
  customer: {
    select: {
      id: true,
      name: true,
      taxCode: true,
      owner: { select: { id: true, fullName: true } },
    },
  },
  obligationType: {
    select: { id: true, code: true, name: true, group: true, cycle: true },
  },
  receiptDocument: { select: { id: true, fileName: true } },
  tasks: {
    where: { deletedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      assigneeId: true,
    },
  },
} satisfies Prisma.CustomerObligationInclude;

type Row = Prisma.CustomerObligationGetPayload<{
  include: typeof LIST_INCLUDE;
}>;

/** Lịch báo cáo của khách hàng (đặc tả 06, I4–I7): xem theo phạm vi KH, cập nhật trạng thái, nộp kèm biên nhận. */
@Injectable()
export class CustomerObligationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly engine: ObligationEngine,
  ) {}

  async list(user: AuthUser, query: ObligationQueryDto) {
    const today = todayVn();
    const where: Prisma.CustomerObligationWhereInput = {
      ...baseWhere(user, query),
      period: query.period,
      ...statusWhere(query.status, today),
      ...((query.dueFrom || query.dueTo) && {
        AND: [
          ...(query.dueFrom
            ? [{ dueDate: { gte: toBusinessDate(query.dueFrom) } }]
            : []),
          ...(query.dueTo
            ? [{ dueDate: { lte: toBusinessDate(query.dueTo) } }]
            : []),
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customerObligation.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.customerObligation.count({ where }),
    ]);
    return paginated(
      items.map((o) => toView(o, today)),
      total,
      query,
    );
  }

  /** Ô đếm màn hình Lịch báo cáo: Chưa đến hạn / Đang chuẩn bị / Trễ hạn / Đã nộp trong tháng (giờ VN). */
  async summary(user: AuthUser, query: ObligationSummaryQueryDto) {
    const today = todayVn();
    const base = baseWhere(user, query);
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const nextMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
    );
    const count = (where: Prisma.CustomerObligationWhereInput) =>
      this.prisma.customerObligation.count({ where: { ...base, ...where } });
    const [notDue, preparing, overdue, filedThisMonth] = await Promise.all([
      count(statusWhere(NOT_DUE, today)),
      count(statusWhere(PREPARING, today)),
      count(statusWhere('OVERDUE', today)),
      count({ status: FILED, filedAt: { gte: monthStart, lt: nextMonth } }),
    ]);
    return { notDue, preparing, overdue, filedThisMonth };
  }

  async findOne(user: AuthUser, id: string) {
    const o = await this.findInScope(user, id);
    const [events, version] = await Promise.all([
      this.prisma.customerObligationEvent.findMany({
        where: { obligationId: id },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.obligationTypeVersion.findUnique({
        where: { id: o.versionId },
        select: { versionNo: true, legalBasis: true },
      }),
    ]);
    const actors = await this.prisma.user.findMany({
      where: {
        id: {
          in: events.map((e) => e.actorId).filter((x): x is string => !!x),
        },
      },
      select: { id: true, fullName: true },
    });
    const name = new Map(actors.map((a) => [a.id, a.fullName]));
    return {
      ...toView(o, todayVn()),
      version,
      events: events.map((e) => ({
        ...e,
        oldDue: e.oldDue && formatBusinessDate(e.oldDue),
        newDue: e.newDue && formatBusinessDate(e.newDue),
        actorName: e.actorId ? (name.get(e.actorId) ?? null) : null,
      })),
    };
  }

  prepare(user: AuthUser, id: string, dto: ObligationActionDto) {
    return this.move(user, id, dto.revision, [NOT_DUE], PREPARING, {
      note: dto.note || 'Đang chuẩn bị',
    });
  }

  /** I7: Đã nộp cần ngày nộp (không sau hôm nay) và file biên nhận, lưu vào kho hồ sơ 02. */
  async file(
    user: AuthUser,
    id: string,
    file: UploadedFileInfo | undefined,
    dto: FileObligationDto,
  ) {
    if (!file) throw new BadRequestException('Vui lòng tải file biên nhận nộp');
    const filedAt = toBusinessDate(dto.filedAt);
    if (filedAt > todayVn())
      throw new BadRequestException('Ngày nộp không được sau hôm nay');
    const o = await this.findInScope(user, id);
    if (!OPEN.includes(o.status) || o.revision !== dto.revision)
      throw new ConflictException(CONFLICT);
    const receipt = await this.documents.upload(user, o.customerId, file, {
      category: DocumentCategory.SERVICE,
      period: o.period,
      note: `Biên nhận nộp ${o.obligationType.name} kỳ ${o.period}`,
    });
    try {
      return await this.move(user, id, dto.revision, OPEN, FILED, {
        note: dto.note || 'Đã nộp',
        data: {
          filedAt,
          filedLate: filedAt > o.dueDate,
          filedById: user.id,
          receiptDocumentId: receipt.id,
          note: dto.note || null,
        },
      });
    } catch (err) {
      await this.prisma.document.update({
        where: { id: receipt.id },
        data: { deletedAt: new Date() },
      });
      throw err;
    }
  }

  notApplicable(user: AuthUser, id: string, dto: ObligationReasonDto) {
    return this.move(user, id, dto.revision, OPEN, NOT_APPLICABLE, {
      note: dto.reason,
      data: { manuallyExcluded: true },
    });
  }

  /** Mở lại (GĐ): Đã nộp → Đang chuẩn bị (nộp bổ sung/sai); Không áp dụng → Chưa đến hạn. */
  async reopen(user: AuthUser, id: string, dto: ObligationReasonDto) {
    const o = await this.findInScope(user, id);
    if (o.status === FILED)
      return this.move(user, id, dto.revision, [FILED], PREPARING, {
        note: `Mở lại: ${dto.reason}`,
        data: { filedAt: null, filedLate: false, filedById: null },
      });
    return this.move(user, id, dto.revision, [NOT_APPLICABLE], NOT_DUE, {
      note: `Mở lại: ${dto.reason}`,
      data: { manuallyExcluded: false },
    });
  }

  /** Loại nghĩa vụ đang áp dụng và cài đặt bật/tắt riêng của KH. */
  async settings(user: AuthUser, customerId: string) {
    await this.ensureCustomer(user, customerId);
    const [types, settings, lines] = await Promise.all([
      this.prisma.obligationType.findMany({
        where: {
          retiredAt: null,
          versions: { some: { status: ObligationVersionStatus.CONFIRMED } },
        },
        include: { services: { select: { serviceTypeId: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.customerObligationSetting.findMany({ where: { customerId } }),
      this.prisma.contractService.findMany({
        where: {
          contract: {
            customerId,
            deletedAt: null,
            status: {
              in: [ContractStatus.NOT_STARTED, ContractStatus.IN_PROGRESS],
            },
          },
        },
        select: { serviceTypeId: true },
      }),
    ]);
    const services = new Set(lines.map((l) => l.serviceTypeId));
    const byType = new Map(settings.map((s) => [s.obligationTypeId, s]));
    return types.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      cycle: t.cycle,
      byService: t.services.some((s) => services.has(s.serviceTypeId)),
      setting: byType.get(t.id) ?? null,
    }));
  }

  async setSetting(
    user: AuthUser,
    customerId: string,
    typeId: string,
    dto: ObligationSettingDto,
  ) {
    await this.ensureCustomer(user, customerId);
    const type = await this.prisma.obligationType.findFirst({
      where: { id: typeId, retiredAt: null },
      select: { id: true },
    });
    if (!type) throw new NotFoundException('Không tìm thấy loại nghĩa vụ');
    const data = {
      enabled: dto.enabled,
      reason: dto.reason,
      updatedById: user.id,
    };
    await this.prisma.customerObligationSetting.upsert({
      where: {
        customerId_obligationTypeId: { customerId, obligationTypeId: typeId },
      },
      create: { ...data, customerId, obligationTypeId: typeId },
      update: data,
    });
    await this.audit.log(
      user.id,
      'OBLIGATION_SETTING',
      'customers',
      customerId,
      {
        obligationTypeId: typeId,
        enabled: dto.enabled,
        reason: dto.reason,
      },
    );
    const synced = await this.engine.syncCustomer(customerId, user.id);
    return { settings: await this.settings(user, customerId), synced };
  }

  private async move(
    user: AuthUser,
    id: string,
    revision: number,
    from: ObligationStatus[],
    to: ObligationStatus,
    extra: {
      note: string;
      data?: Prisma.CustomerObligationUncheckedUpdateManyInput;
    },
  ) {
    const o = await this.findInScope(user, id);
    if (!from.includes(o.status))
      throw new BadRequestException(
        `Không thể chuyển từ "${STATUS_LABEL[o.status]}" sang "${STATUS_LABEL[to]}"`,
      );
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.customerObligation.updateMany({
        where: { id, status: o.status, revision },
        data: { ...extra.data, status: to, revision: { increment: 1 } },
      });
      if (!count) throw new ConflictException(CONFLICT);
      await tx.customerObligationEvent.create({
        data: {
          obligationId: id,
          fromStatus: o.status,
          toStatus: to,
          note: extra.note,
          actorId: user.id,
        },
      });
    });
    await this.audit.log(user.id, `OBLIGATION_${to}`, 'deadlines', id, {
      from: o.status,
      to,
      note: extra.note,
    });
    return this.findOne(user, id);
  }

  private async findInScope(user: AuthUser, id: string): Promise<Row> {
    const o = await this.prisma.customerObligation.findFirst({
      where: { id, customer: { ...customerScope(user), deletedAt: null } },
      include: LIST_INCLUDE,
    });
    if (!o) throw new NotFoundException('Không tìm thấy nghĩa vụ');
    return o;
  }

  private async ensureCustomer(user: AuthUser, customerId: string) {
    const found = await this.prisma.customer.findFirst({
      where: { ...customerScope(user), id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Không tìm thấy khách hàng');
  }
}

const STATUS_LABEL: Record<ObligationStatus, string> = {
  NOT_DUE: 'Chưa đến hạn',
  PREPARING: 'Đang chuẩn bị',
  FILED: 'Đã nộp',
  NOT_APPLICABLE: 'Không áp dụng',
};

/**
 * Phạm vi KH + bộ lọc chung. Các điều kiện KH ghép bằng AND: phạm vi (02, F6) có `OR` riêng nên
 * không được trộn chung một object với `OR` của ô tìm kiếm.
 */
function baseWhere(
  user: AuthUser,
  query: ObligationSummaryQueryDto,
): Prisma.CustomerObligationWhereInput {
  const customer: Prisma.CustomerWhereInput[] = [
    customerScope(user),
    { deletedAt: null },
  ];
  if (query.ownerId) customer.push({ ownerId: query.ownerId });
  if (query.search)
    customer.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { taxCode: { contains: query.search } },
      ],
    });
  return {
    customer: { AND: customer },
    customerId: query.customerId,
    obligationTypeId: query.obligationTypeId,
  };
}

function statusWhere(
  status: ObligationQueryDto['status'],
  today: Date,
): Prisma.CustomerObligationWhereInput {
  if (!status) return {};
  if (status === 'OVERDUE')
    return { status: { in: OPEN }, dueDate: { lt: today } };
  if (status === NOT_DUE || status === PREPARING)
    return { status, dueDate: { gte: today } };
  return { status };
}

/** Trạng thái hiển thị: chưa nộp mà quá hạn (giờ VN) → OVERDUE "Trễ hạn" (I7). */
function toView(o: Row, today: Date) {
  const overdue = OPEN.includes(o.status) && o.dueDate < today;
  return {
    ...o,
    displayStatus: overdue ? 'OVERDUE' : o.status,
    period: o.period,
    periodEnd: formatBusinessDate(o.periodEnd),
    dueDate: formatBusinessDate(o.dueDate),
    originalDueDate: formatBusinessDate(o.originalDueDate),
    filedAt: o.filedAt && formatBusinessDate(o.filedAt),
  };
}
