import {
  ContractStatus,
  CustomerStatus,
  ObligationStatus,
  ObligationVersionStatus,
  Prisma,
  type ObligationCycle,
  type ObligationTypeVersion,
} from '@prisma/client';
import { type WorkingCalendar } from '../../common/working-calendar';
import { endOfPeriod } from '../service-catalog/workflow-schedule.util';
import {
  type CustomerTaxProfile,
  type DueRuleInput,
  matchesConditions,
  obligationPeriodEnd,
  obligationPeriodForTask,
  parseConditions,
  periodsEndingBetween,
  latestVersion,
  periodStartOf,
  statutoryDueDate,
  versionForPeriod,
} from './obligation.rules';

/**
 * Sinh, thu hồi và tính lại lịch báo cáo của khách hàng (đặc tả 06, I4–I8). File thuần (không phụ
 * thuộc NestJS) để bộ sinh việc (05) và seed dùng chung. Mọi ghi đều idempotent theo khoá (KH, loại, kỳ).
 */

type Db = Prisma.TransactionClient;

/** Sinh trước tối đa ~13 tháng; tác vụ hằng đêm (06-C) nối dài. */
export const HORIZON_DAYS = 400;
const DAY_MS = 86_400_000;
const ACTIVE_CONTRACT: ContractStatus[] = [
  ContractStatus.NOT_STARTED,
  ContractStatus.IN_PROGRESS,
];
const OPEN: ObligationStatus[] = [
  ObligationStatus.NOT_DUE,
  ObligationStatus.PREPARING,
];

export { loadWorkingCalendar } from './working-calendar.loader';

export function toRule(v: ObligationTypeVersion): DueRuleInput {
  return {
    dueRule: v.dueRule,
    monthsAfter: v.monthsAfter,
    dueMonth: v.dueMonth,
    dueDay: v.dueDay,
    useFiscalYear: v.useFiscalYear,
    holidayShift: v.holidayShift,
  };
}

export const PROFILE_SELECT = {
  status: true,
  deletedAt: true,
  taxPeriod: true,
  vatMethod: true,
  pitPeriod: true,
  accountingRegime: true,
  fiscalYearEndMonth: true,
} satisfies Prisma.CustomerSelect;

export interface TypeForSync {
  id: string;
  cycle: ObligationCycle;
  serviceTypeIds: string[];
  /** Phiên bản đã xác nhận. */
  versions: ObligationTypeVersion[];
}

export interface DesiredObligation {
  typeId: string;
  versionId: string;
  period: string;
  periodEnd: Date;
  dueDate: Date;
}

/** Hạn của một kỳ theo phiên bản áp dụng; null khi không có phiên bản hoặc KH không thoả điều kiện. */
export function dueFor(
  type: Pick<TypeForSync, 'cycle' | 'versions'>,
  period: string,
  profile: CustomerTaxProfile,
  calendar: WorkingCalendar,
): DesiredObligation | null {
  const latest = latestVersion(type.versions);
  if (!latest) return null;
  const guessEnd = obligationPeriodEnd(type.cycle, period, latest, profile);
  const version = versionForPeriod(type.versions, guessEnd) ?? null;
  if (!version) return null;
  const conditions = parseConditions(version.conditions);
  if (typeof conditions === 'string' || !matchesConditions(conditions, profile))
    return null;
  const periodEnd = obligationPeriodEnd(type.cycle, period, version, profile);
  return {
    typeId: version.typeId,
    versionId: version.id,
    period,
    periodEnd,
    dueDate: statutoryDueDate(toRule(version), period, periodEnd, calendar),
  };
}

export interface SyncInput {
  profile: CustomerTaxProfile;
  /** KH Đang phục vụ, chưa xoá. */
  active: boolean;
  types: TypeForSync[];
  /** Dòng HĐ hiệu lực: dịch vụ và thời hạn HĐ. */
  lines: { serviceTypeId: string; from: Date; to: Date | null }[];
  /** Bật/tắt theo KH; `since` = lúc bật tay (khoảng sinh khi không có dịch vụ). */
  settings: Map<string, { enabled: boolean; since: Date }>;
  today: Date;
  calendar: WorkingCalendar;
}

/**
 * Các nghĩa vụ KH cần có (I4): theo dịch vụ trong HĐ hiệu lực và bật/tắt riêng, trong tầm sinh; chỉ
 * kỳ chưa quá hạn. Kỳ đã qua chỉ được tạo khi có việc gắn (`ensureObligationForTask`).
 */
export function desiredObligations(input: SyncInput): DesiredObligation[] {
  if (!input.active) return [];
  const horizon = new Date(input.today.getTime() + HORIZON_DAYS * DAY_MS);
  const result: DesiredObligation[] = [];
  for (const type of input.types) {
    const setting = input.settings.get(type.id);
    if (setting && !setting.enabled) continue;
    const ranges = input.lines
      .filter((l) => type.serviceTypeIds.includes(l.serviceTypeId))
      .map((l) => ({
        from: l.from,
        to: l.to && l.to < horizon ? l.to : horizon,
      }));
    // Bật tay chỉ mở khoảng sinh khi HĐ không có dịch vụ gắn loại này; có dịch vụ thì "bật lại"
    // chỉ huỷ việc tắt, vẫn sinh trong thời hạn HĐ.
    if (setting?.enabled && ranges.length === 0)
      ranges.push({ from: setting.since, to: horizon });
    const latest = latestVersion(type.versions);
    if (!latest || ranges.length === 0) continue;
    const fy = latest.useFiscalYear ? input.profile.fiscalYearEndMonth : 12;
    const periods = new Set(
      ranges.flatMap((r) => periodsEndingBetween(type.cycle, r.from, r.to, fy)),
    );
    for (const period of periods) {
      const due = dueFor(type, period, input.profile, input.calendar);
      // Không sinh bù kỳ đã qua hạn (tránh báo "Trễ hạn" cho kỳ đã nộp ngoài hệ thống).
      if (due && due.dueDate >= input.today) result.push(due);
    }
  }
  return result;
}

async function loadTypes(db: Db, where: Prisma.ObligationTypeWhereInput = {}) {
  const types = await db.obligationType.findMany({
    where: { retiredAt: null, ...where },
    include: {
      versions: { where: { status: ObligationVersionStatus.CONFIRMED } },
      services: { select: { serviceTypeId: true } },
    },
  });
  return types.map((t): TypeForSync & { family: string } => ({
    id: t.id,
    family: t.family,
    cycle: t.cycle,
    versions: t.versions,
    serviceTypeIds: t.services.map((s) => s.serviceTypeId),
  }));
}

export interface SyncResult {
  created: number;
  revived: number;
  retired: number;
}

const NOTE_CREATED = 'Sinh theo lịch pháp lý';
const NOTE_RETIRED =
  'Không còn áp dụng: hồ sơ khách hàng, hợp đồng hoặc cấu hình thay đổi';
const NOTE_REVIVED = 'Áp dụng lại theo hồ sơ khách hàng/hợp đồng';

function loadSyncData(db: Db, customerId: string) {
  return Promise.all([
    loadTypes(db),
    db.contractService.findMany({
      where: {
        contract: {
          customerId,
          status: { in: ACTIVE_CONTRACT },
          deletedAt: null,
        },
      },
      select: {
        serviceTypeId: true,
        contract: { select: { startDate: true, endDate: true } },
      },
    }),
    db.customerObligationSetting.findMany({ where: { customerId } }),
    db.customerObligation.findMany({
      where: { customerId },
      include: { _count: { select: { tasks: true } }, obligationType: true },
    }),
  ]);
}

/**
 * Đồng bộ lịch báo cáo của một KH: tạo kỳ còn thiếu; kỳ **chưa bắt đầu**, chưa có việc gắn và còn
 * "Chưa đến hạn" mà không còn áp dụng → Không áp dụng; kỳ tự đánh Không áp dụng mà áp dụng lại → mở lại.
 */
export async function syncCustomerObligations(
  db: Db,
  customerId: string,
  options: { calendar: WorkingCalendar; today: Date; actorId: string | null },
): Promise<SyncResult> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: PROFILE_SELECT,
  });
  if (!customer) return { created: 0, revived: 0, retired: 0 };
  const [types, lines, settings, existing] = await loadSyncData(db, customerId);
  const desired = desiredObligations({
    profile: customer,
    active: customer.status === CustomerStatus.ACTIVE && !customer.deletedAt,
    types,
    lines: lines.map((l) => ({
      serviceTypeId: l.serviceTypeId,
      from: l.contract.startDate,
      to: l.contract.endDate,
    })),
    settings: new Map(
      settings.map((s) => [
        s.obligationTypeId,
        { enabled: s.enabled, since: s.updatedAt },
      ]),
    ),
    today: options.today,
    calendar: options.calendar,
  });
  const key = (typeId: string, period: string) => `${typeId}|${period}`;
  const wanted = new Map(desired.map((d) => [key(d.typeId, d.period), d]));
  const have = new Map(
    existing.map((o) => [key(o.obligationTypeId, o.period), o]),
  );
  const missing = desired.filter((d) => !have.has(key(d.typeId, d.period)));
  const result: SyncResult = {
    created: await createMissing(db, customerId, missing, options.actorId),
    revived: 0,
    retired: 0,
  };
  for (const o of existing) {
    const started =
      periodStartOf(
        o.obligationType.cycle,
        o.period,
        customer.fiscalYearEndMonth,
      ) <= options.today;
    if (started) continue;
    const want = wanted.get(key(o.obligationTypeId, o.period));
    if (!want && o.status === ObligationStatus.NOT_DUE && !o._count.tasks) {
      const to = ObligationStatus.NOT_APPLICABLE;
      if (await moveStatus(db, o, to, NOTE_RETIRED, options.actorId))
        result.retired++;
    } else if (
      want &&
      o.status === ObligationStatus.NOT_APPLICABLE &&
      !o.manuallyExcluded
    ) {
      const to = ObligationStatus.NOT_DUE;
      if (await moveStatus(db, o, to, NOTE_REVIVED, options.actorId, want))
        result.revived++;
    }
  }
  return result;
}

async function createMissing(
  db: Db,
  customerId: string,
  missing: DesiredObligation[],
  actorId: string | null,
): Promise<number> {
  if (!missing.length) return 0;
  const created = await db.customerObligation.createManyAndReturn({
    data: missing.map((d) => ({
      customerId,
      obligationTypeId: d.typeId,
      versionId: d.versionId,
      period: d.period,
      periodEnd: d.periodEnd,
      dueDate: d.dueDate,
      originalDueDate: d.dueDate,
    })),
    skipDuplicates: true,
    select: { id: true, dueDate: true },
  });
  await db.customerObligationEvent.createMany({
    data: created.map((o) => ({
      obligationId: o.id,
      toStatus: ObligationStatus.NOT_DUE,
      newDue: o.dueDate,
      note: NOTE_CREATED,
      actorId,
    })),
  });
  return created.length;
}

async function moveStatus(
  db: Db,
  o: { id: string; status: ObligationStatus; revision: number; dueDate: Date },
  to: ObligationStatus,
  note: string,
  actorId: string | null,
  due?: DesiredObligation,
): Promise<boolean> {
  const { count } = await db.customerObligation.updateMany({
    where: { id: o.id, status: o.status, revision: o.revision },
    data: {
      status: to,
      revision: { increment: 1 },
      ...(due && { dueDate: due.dueDate, versionId: due.versionId }),
    },
  });
  if (count)
    await db.customerObligationEvent.create({
      data: {
        obligationId: o.id,
        fromStatus: o.status,
        toStatus: to,
        ...(due &&
          due.dueDate.getTime() !== o.dueDate.getTime() && {
            oldDue: o.dueDate,
            newDue: due.dueDate,
          }),
        note,
        actorId,
      },
    });
  return count === 1;
}

/** Nghĩa vụ của kỳ (tạo kèm lịch sử nếu chưa có); kỳ đã Không áp dụng → null. */
async function findOrCreate(
  db: Db,
  customerId: string,
  due: DesiredObligation,
  actorId: string | null,
): Promise<{ id: string; dueDate: Date } | null> {
  const where = {
    customerId_obligationTypeId_period: {
      customerId,
      obligationTypeId: due.typeId,
      period: due.period,
    },
  };
  const found = await db.customerObligation.findUnique({ where });
  if (found)
    return found.status === ObligationStatus.NOT_APPLICABLE ? null : found;
  const [created] = await db.customerObligation.createManyAndReturn({
    data: [
      {
        customerId,
        obligationTypeId: due.typeId,
        versionId: due.versionId,
        period: due.period,
        periodEnd: due.periodEnd,
        dueDate: due.dueDate,
        originalDueDate: due.dueDate,
      },
    ],
    skipDuplicates: true,
  });
  if (!created) return db.customerObligation.findUnique({ where });
  await db.customerObligationEvent.create({
    data: {
      obligationId: created.id,
      toStatus: ObligationStatus.NOT_DUE,
      newDue: created.dueDate,
      note: NOTE_CREATED,
      actorId,
    },
  });
  return created;
}

/**
 * I6: nghĩa vụ mà việc của bước pháp lý (gắn `obligationTypeId`) phục vụ. Tìm trong cùng `family`
 * biến thể khớp hồ sơ KH và kỳ của việc; tạo nếu chưa có. Loại bị tắt cho KH hoặc kỳ đã Không áp
 * dụng → null (việc giữ cách tính hạn cũ).
 */
export async function ensureObligationForTask(
  db: Db,
  input: {
    customerId: string;
    obligationTypeId: string;
    taskPeriod: string;
    calendar: WorkingCalendar;
    actorId: string | null;
  },
): Promise<{ id: string; dueDate: Date } | null> {
  const chosen = await db.obligationType.findUnique({
    where: { id: input.obligationTypeId },
    select: { family: true },
  });
  const customer = await db.customer.findUnique({
    where: { id: input.customerId },
    select: PROFILE_SELECT,
  });
  if (!chosen || !customer) return null;
  const candidates = (await loadTypes(db, { family: chosen.family })).sort(
    (a, b) =>
      Number(b.id === input.obligationTypeId) -
      Number(a.id === input.obligationTypeId),
  );
  const disabled = new Set(
    (
      await db.customerObligationSetting.findMany({
        where: { customerId: input.customerId, enabled: false },
        select: { obligationTypeId: true },
      })
    ).map((s) => s.obligationTypeId),
  );
  const taskEnd = endOfPeriod(input.taskPeriod);
  for (const type of candidates) {
    if (disabled.has(type.id)) continue;
    const latest = latestVersion(type.versions);
    if (!latest) continue;
    const fy = latest.useFiscalYear ? customer.fiscalYearEndMonth : 12;
    const period = obligationPeriodForTask(
      type.cycle,
      input.taskPeriod,
      taskEnd,
      fy,
    );
    if (!period) continue;
    const due = dueFor(type, period, customer, input.calendar);
    if (!due) continue;
    return findOrCreate(db, input.customerId, due, input.actorId);
  }
  return null;
}

export interface DueChange {
  obligationId: string;
  oldDue: Date;
  newDue: Date;
}

/**
 * I8: tính lại hạn các nghĩa vụ chưa nộp và chưa tới hạn theo lịch/quy tắc hiện hành. Trả danh sách
 * hạn đã đổi để 05 đổi hạn việc gắn.
 */
export async function recalculateObligationDues(
  db: Db,
  options: {
    calendar: WorkingCalendar;
    today: Date;
    actorId: string;
    reason: string;
    typeIds?: string[];
  },
): Promise<DueChange[]> {
  const obligations = await db.customerObligation.findMany({
    where: {
      status: { in: OPEN },
      dueDate: { gte: options.today },
      ...(options.typeIds && { obligationTypeId: { in: options.typeIds } }),
    },
    include: { customer: { select: PROFILE_SELECT } },
  });
  if (!obligations.length) return [];
  const types = new Map((await loadTypes(db)).map((t) => [t.id, t]));
  const changes: DueChange[] = [];
  for (const o of obligations) {
    const type = types.get(o.obligationTypeId);
    if (!type) continue;
    const due = dueFor(type, o.period, o.customer, options.calendar);
    if (!due) continue;
    const sameDue = due.dueDate.getTime() === o.dueDate.getTime();
    if (sameDue && due.versionId === o.versionId) continue;
    const { count } = await db.customerObligation.updateMany({
      where: { id: o.id, revision: o.revision, status: o.status },
      data: {
        dueDate: due.dueDate,
        periodEnd: due.periodEnd,
        versionId: due.versionId,
        revision: { increment: 1 },
      },
    });
    if (!count || sameDue) continue;
    await db.customerObligationEvent.create({
      data: {
        obligationId: o.id,
        fromStatus: o.status,
        toStatus: o.status,
        oldDue: o.dueDate,
        newDue: due.dueDate,
        note: options.reason,
        actorId: options.actorId,
      },
    });
    changes.push({
      obligationId: o.id,
      oldDue: o.dueDate,
      newDue: due.dueDate,
    });
  }
  return changes;
}
