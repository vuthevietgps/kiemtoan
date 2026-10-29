import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HolidayShift,
  ObligationCycle,
  ObligationVersionStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  addDays,
  formatBusinessDate,
  todayVn,
  toBusinessDate,
} from '../reports/utils/period.util';
import {
  CreateObligationTypeDto,
  ObligationPreviewQueryDto,
  ObligationVersionDto,
  ReasonDto,
  RevisionDto,
  SaveObligationDraftDto,
  SetObligationServicesDto,
  UpdateObligationTypeDto,
} from './dto/deadlines.dto';
import { ObligationEngine } from './obligation-engine.service';
import { loadWorkingCalendar, PROFILE_SELECT } from './obligation-sync';
import {
  dueRuleError,
  matchesConditions,
  obligationPeriodEnd,
  parseConditions,
  periodsEndingBetween,
  rawDueDate,
  statutoryDueDate,
} from './obligation.rules';

const { DRAFT, CONFIRMED } = ObligationVersionStatus;
const CONFLICT =
  'Loại nghĩa vụ vừa được người khác sửa hoặc xác nhận; vui lòng tải lại';

const TYPE_INCLUDE = {
  versions: { orderBy: { versionNo: 'desc' } },
  services: {
    select: { serviceType: { select: { id: true, code: true, name: true } } },
  },
} satisfies Prisma.ObligationTypeInclude;

/** Danh mục loại nghĩa vụ pháp lý (đặc tả 06, I1): KTT soạn nháp, GĐ xác nhận; chỉ bản đã xác nhận sinh hạn. */
@Injectable()
export class ObligationTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly engine: ObligationEngine,
  ) {}

  async list() {
    const types = await this.prisma.obligationType.findMany({
      include: TYPE_INCLUDE,
      orderBy: [
        { retiredAt: { sort: 'desc', nulls: 'first' } },
        { code: 'asc' },
      ],
    });
    return types.map(toView);
  }

  async findOne(id: string) {
    const type = await this.prisma.obligationType.findUnique({
      where: { id },
      include: TYPE_INCLUDE,
    });
    if (!type) throw new NotFoundException('Không tìm thấy loại nghĩa vụ');
    return toView(type);
  }

  async create(user: AuthUser, dto: CreateObligationTypeDto) {
    const version = versionData(dto.cycle, dto);
    try {
      const type = await this.prisma.obligationType.create({
        data: {
          code: dto.code,
          name: dto.name,
          group: dto.group,
          family: dto.family ?? dto.code,
          cycle: dto.cycle,
          createdById: user.id,
          versions: {
            create: { ...version, versionNo: 1, createdById: user.id },
          },
        },
      });
      await this.audit.log(
        user.id,
        'OBLIGATION_TYPE_CREATE',
        'deadlines',
        type.id,
        {
          code: dto.code,
        },
      );
      return this.findOne(type.id);
    } catch (err) {
      if (isUnique(err))
        throw new ConflictException('Mã loại nghĩa vụ đã tồn tại');
      throw err;
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateObligationTypeDto) {
    const before = await this.findOne(id);
    await this.prisma.obligationType.update({ where: { id }, data: dto });
    await this.audit.log(user.id, 'OBLIGATION_TYPE_UPDATE', 'deadlines', id, {
      before: { name: before.name, group: before.group, family: before.family },
      after: { ...dto },
    });
    return this.findOne(id);
  }

  /** Tạo hoặc sửa bản nháp quy tắc (mỗi loại tối đa một nháp). */
  async saveDraft(user: AuthUser, id: string, dto: SaveObligationDraftDto) {
    const type = await this.findOne(id);
    if (type.retiredAt) throw new BadRequestException('Loại nghĩa vụ đã ngừng');
    const data = versionData(type.cycle, dto);
    const draft = type.versions.find((v) => v.status === DRAFT);
    if (draft) {
      const { count } = await this.prisma.obligationTypeVersion.updateMany({
        where: { id: draft.id, status: DRAFT, revision: dto.revision ?? -1 },
        data: { ...data, revision: { increment: 1 } },
      });
      if (!count) throw new ConflictException(CONFLICT);
    } else {
      const versionNo =
        Math.max(0, ...type.versions.map((v) => v.versionNo)) + 1;
      await this.prisma.obligationTypeVersion
        .create({
          data: { ...data, typeId: id, versionNo, createdById: user.id },
        })
        .catch((err: unknown) => {
          throw isUnique(err) ? new ConflictException(CONFLICT) : err;
        });
    }
    await this.audit.log(user.id, 'OBLIGATION_DRAFT_SAVE', 'deadlines', id, {
      ...data,
      effectiveFrom: dto.effectiveFrom,
    });
    return this.findOne(id);
  }

  /** GĐ xác nhận bản nháp → áp dụng; tính lại hạn chưa tới (I8) và sinh lịch báo cáo (I4). */
  async confirm(user: AuthUser, id: string, dto: RevisionDto) {
    const type = await this.findOne(id);
    if (type.retiredAt) throw new BadRequestException('Loại nghĩa vụ đã ngừng');
    const draft = type.versions.find((v) => v.status === DRAFT);
    if (!draft) throw new BadRequestException('Không có bản nháp để xác nhận');
    versionData(type.cycle, {
      ...draft,
      effectiveFrom: formatBusinessDate(draft.effectiveFrom),
      conditions: draft.conditions as Record<string, unknown>,
    });
    const { count } = await this.prisma.obligationTypeVersion.updateMany({
      where: { id: draft.id, status: DRAFT, revision: dto.revision },
      data: {
        status: CONFIRMED,
        revision: { increment: 1 },
        confirmedById: user.id,
        confirmedAt: new Date(),
      },
    });
    if (!count) throw new ConflictException(CONFLICT);
    await this.audit.log(user.id, 'OBLIGATION_CONFIRM', 'deadlines', id, {
      versionNo: draft.versionNo,
    });
    const changedDues = await this.engine.recalculate(
      user.id,
      `Quy tắc ${type.code} phiên bản ${draft.versionNo} được xác nhận`,
      [id],
    );
    const synced = await this.engine.syncAll(user.id);
    return { ...(await this.findOne(id)), changedDues, synced };
  }

  /** Ngừng: không sinh kỳ mới; kỳ chưa bắt đầu chưa có việc gắn chuyển Không áp dụng. */
  async retire(user: AuthUser, id: string, dto: ReasonDto) {
    const { count } = await this.prisma.obligationType.updateMany({
      where: { id, retiredAt: null },
      data: {
        retiredAt: new Date(),
        retiredById: user.id,
        retireReason: dto.reason,
      },
    });
    if (!count)
      throw new ConflictException('Loại nghĩa vụ không tồn tại hoặc đã ngừng');
    await this.audit.log(user.id, 'OBLIGATION_RETIRE', 'deadlines', id, {
      reason: dto.reason,
    });
    const synced = await this.engine.syncAll(user.id);
    return { ...(await this.findOne(id)), synced };
  }

  /** Gắn dịch vụ ↔ loại nghĩa vụ (I4), rồi đồng bộ lịch báo cáo. */
  async setServices(user: AuthUser, id: string, dto: SetObligationServicesDto) {
    const before = await this.findOne(id);
    const ids = [...new Set(dto.serviceTypeIds)];
    const found = await this.prisma.serviceType.count({
      where: { id: { in: ids } },
    });
    if (found !== ids.length)
      throw new BadRequestException('Có dịch vụ không tồn tại');
    await this.prisma.$transaction([
      this.prisma.serviceObligationType.deleteMany({
        where: { obligationTypeId: id },
      }),
      this.prisma.serviceObligationType.createMany({
        data: ids.map((serviceTypeId) => ({
          serviceTypeId,
          obligationTypeId: id,
          createdById: user.id,
        })),
      }),
    ]);
    await this.audit.log(user.id, 'OBLIGATION_SERVICES', 'deadlines', id, {
      before: before.services.map((s) => s.id),
      after: ids,
    });
    const synced = await this.engine.syncAll(user.id);
    return { ...(await this.findOne(id)), synced };
  }

  /** Xem trước hạn các kỳ tới cho một KH: bản nháp nếu có, không thì bản xác nhận mới nhất. */
  async preview(id: string, query: ObligationPreviewQueryDto) {
    const type = await this.findOne(id);
    const version =
      type.versions.find((v) => v.status === DRAFT) ??
      type.versions.find((v) => v.status === CONFIRMED);
    if (!version)
      throw new BadRequestException('Loại nghĩa vụ chưa có quy tắc');
    const customer = await this.prisma.customer.findFirst({
      where: { id: query.customerId, deletedAt: null },
      select: { ...PROFILE_SELECT, name: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    const calendar = await loadWorkingCalendar(this.prisma);
    const today = todayVn();
    const fy = version.useFiscalYear ? customer.fiscalYearEndMonth : 12;
    const periods = periodsEndingBetween(
      type.cycle,
      today,
      addDays(today, 3 * 366),
      fy,
    ).slice(0, query.periods ?? 12);
    const conditions = parseConditions(version.conditions);
    return {
      versionNo: version.versionNo,
      status: version.status,
      customer: { id: query.customerId, name: customer.name },
      applies:
        typeof conditions !== 'string' &&
        matchesConditions(conditions, customer),
      periods: periods.map((period) => {
        const end = obligationPeriodEnd(type.cycle, period, version, customer);
        return {
          period,
          periodEnd: formatBusinessDate(end),
          ruleDue: formatBusinessDate(rawDueDate(version, period, end)),
          dueDate: formatBusinessDate(
            statutoryDueDate(version, period, end, calendar),
          ),
        };
      }),
    };
  }
}

/** Kiểm tra và chuẩn hoá dữ liệu phiên bản; lỗi → 400. */
function versionData(cycle: ObligationCycle, dto: ObligationVersionDto) {
  const rule = {
    dueRule: dto.dueRule,
    monthsAfter: dto.monthsAfter ?? null,
    dueMonth: dto.dueMonth ?? null,
    dueDay: dto.dueDay,
    useFiscalYear: dto.useFiscalYear ?? true,
    holidayShift: dto.holidayShift ?? HolidayShift.NEXT,
  };
  const error = dueRuleError(cycle, rule);
  if (error) throw new BadRequestException(error);
  const conditions = parseConditions(dto.conditions ?? {});
  if (typeof conditions === 'string') throw new BadRequestException(conditions);
  return {
    ...rule,
    effectiveFrom: toBusinessDate(dto.effectiveFrom),
    conditions: conditions as Prisma.InputJsonObject,
    legalBasis: dto.legalBasis || null,
    note: dto.note || null,
  };
}

type TypeRow = Prisma.ObligationTypeGetPayload<{
  include: typeof TYPE_INCLUDE;
}>;

function toView(type: TypeRow) {
  const { services, ...rest } = type;
  return { ...rest, services: services.map((s) => s.serviceType) };
}

function isUnique(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}
