import {
  ContractPlanStatus,
  Prisma,
  Role,
  WorkflowScheduleMode,
  WorkflowVersionStatus,
} from '@prisma/client';
import type { WorkingCalendar } from '../../common/working-calendar';
import { loadWorkingCalendar } from '../deadlines/working-calendar.loader';
import { scheduleSteps } from '../service-catalog/workflow-schedule.util';

/**
 * Lập và xác nhận kế hoạch thực hiện cho dòng dịch vụ (đặc tả 04-B). File thuần (không phụ thuộc
 * NestJS) để dùng chung cho service, seed và test. Lỗi nghiệp vụ ném PlanError với thông báo tiếng Việt.
 */

type Client = Prisma.TransactionClient;

export class PlanError extends Error {
  constructor(
    message: string,
    readonly kind: 'invalid' | 'conflict' = 'invalid',
  ) {
    super(message);
  }
}

export interface PlanStepInput {
  stepKey: string;
  required: boolean;
  skipped: boolean;
  durationDays: number | null;
  dueOffsetDays: number | null;
  dependsOn: string[];
}

/** Bỏ bước bị bỏ qua khỏi đồ thị: bước sau chờ thẳng các bước mà bước bị bỏ đang chờ. */
export function activeSteps<T extends PlanStepInput>(steps: T[]): T[] {
  const byKey = new Map(steps.map((s) => [s.stepKey, s]));
  const resolve = (key: string, seen = new Set<string>()): string[] => {
    const step = byKey.get(key);
    if (!step || seen.has(key)) return [];
    if (!step.skipped) return [key];
    seen.add(key);
    return step.dependsOn.flatMap((d) => resolve(d, seen));
  };
  return steps
    .filter((s) => !s.skipped)
    .map((s) => ({
      ...s,
      dependsOn: [...new Set(s.dependsOn.flatMap((d) => resolve(d)))],
    }));
}

/**
 * Ngày bắt đầu/hạn của từng bước theo cách lập lịch; bước bỏ qua giữ ngày như khi không bỏ.
 * Ngày làm việc theo lịch 06 (I2/I3) khi truyền `calendar`.
 */
export function scheduleDates(
  mode: WorkflowScheduleMode,
  steps: PlanStepInput[],
  startDate: Date,
  period: string,
  calendar?: WorkingCalendar,
): Map<string, { plannedStart: Date | null; dueDate: Date }> {
  const toSchedulable = (list: PlanStepInput[]) =>
    list.map((s) => ({
      key: s.stepKey,
      dependsOn: s.dependsOn,
      durationDays: s.durationDays,
      dueOffsetDays: s.dueOffsetDays,
    }));
  const options = { startDate, period, calendar };
  const dates = new Map<string, { plannedStart: Date | null; dueDate: Date }>();
  for (const pass of [steps, activeSteps(steps)]) {
    for (const s of scheduleSteps(mode, toSchedulable(pass), options).steps)
      dates.set(s.key, { plannedStart: s.start, dueDate: s.end });
  }
  return dates;
}

/** Người thực hiện đề xuất: mặc định của bước (còn hoạt động) → dòng dịch vụ → HĐ → khách hàng. */
export function suggestAssignee(
  stepDefault: string | null,
  activeUsers: Set<string>,
  ...fallbacks: (string | null)[]
): string | null {
  if (stepDefault && activeUsers.has(stepDefault)) return stepDefault;
  return fallbacks.find((id) => !!id) ?? null;
}

export async function activeUserIds(
  tx: Client,
  ids: (string | null | undefined)[],
) {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (wanted.length === 0) return new Set<string>();
  const users = await tx.user.findMany({
    where: {
      id: { in: wanted },
      isActive: true,
      deletedAt: null,
      leftAt: null,
      role: { not: Role.ADMIN },
    },
    select: { id: true },
  });
  return new Set(users.map((u) => u.id));
}

const VERSION_FOR_PLAN = {
  template: { select: { code: true, serviceTypeId: true } },
  steps: {
    orderBy: { sortOrder: 'asc' },
    include: {
      dependsOn: { select: { dependsOn: { select: { stepKey: true } } } },
    },
  },
  requirements: {
    orderBy: { sortOrder: 'asc' },
    include: { step: { select: { stepKey: true } } },
  },
} satisfies Prisma.WorkflowTemplateVersionInclude;

async function pickVersion(
  tx: Client,
  serviceTypeId: string,
  workflowVersionId?: string,
) {
  const version = await tx.workflowTemplateVersion.findFirst({
    where: {
      status: WorkflowVersionStatus.PUBLISHED,
      deletedAt: null,
      ...(workflowVersionId && { id: workflowVersionId }),
      template: {
        serviceTypeId,
        isActive: true,
        deletedAt: null,
        ...(!workflowVersionId && { isDefault: true }),
      },
    },
    include: VERSION_FOR_PLAN,
  });
  if (!version)
    throw new PlanError(
      workflowVersionId
        ? 'Phiên bản quy trình không thuộc dịch vụ này hoặc không còn hiệu lực'
        : 'Dịch vụ chưa có quy trình đang hiệu lực; hãy phát hành quy trình ở Dịch vụ & quy trình',
    );
  return version;
}

export interface CreatePlanOptions {
  workflowVersionId?: string;
  startDate?: Date;
  period?: string;
  userId?: string | null;
}

/** Tạo (hoặc lập lại) kế hoạch nháp cho dòng dịch vụ từ phiên bản quy trình; trả về id kế hoạch. */
export async function createPlan(
  tx: Client,
  lineId: string,
  options: CreatePlanOptions = {},
): Promise<string> {
  const line = await tx.contractService.findUniqueOrThrow({
    where: { id: lineId },
    include: {
      plan: { select: { id: true, status: true } },
      contract: {
        select: {
          startDate: true,
          ownerId: true,
          customer: { select: { ownerId: true } },
        },
      },
    },
  });
  if (line.plan?.status === ContractPlanStatus.CONFIRMED)
    throw new PlanError(
      'Kế hoạch đã xác nhận; hãy mở lại trước khi lập lại',
      'conflict',
    );
  const version = await pickVersion(
    tx,
    line.serviceTypeId,
    options.workflowVersionId,
  );
  const startDate = options.startDate ?? line.contract.startDate;
  const period =
    options.period ?? line.period ?? startDate.toISOString().slice(0, 7);
  const active = await activeUserIds(
    tx,
    version.steps.flatMap((s) => [
      s.defaultAssigneeId,
      s.defaultReviewerId,
      s.defaultApproverId,
    ]),
  );
  const steps = version.steps.map((s) => ({
    stepKey: s.stepKey,
    sortOrder: s.sortOrder,
    phase: s.phase,
    name: s.name,
    required: s.required,
    skipped: false,
    durationDays: s.durationDays,
    dueOffsetDays: s.dueOffsetDays,
    dependsOn: s.dependsOn.map((d) => d.dependsOn.stepKey),
    requiresEvidence: s.requiresEvidence,
    requiresDelivery: s.requiresDelivery,
    isStatutory: s.isStatutory,
    obligationTypeId: s.obligationTypeId,
    reviewLevels: s.reviewLevels,
    reviewerRole: s.reviewerRole,
    sourceStepId: s.id,
    assigneeId: suggestAssignee(
      s.defaultAssigneeId,
      active,
      line.assigneeId,
      line.contract.ownerId,
      line.contract.customer.ownerId,
    ),
    reviewerId:
      s.defaultReviewerId && active.has(s.defaultReviewerId)
        ? s.defaultReviewerId
        : null,
    approverId:
      s.reviewLevels >= 2 &&
      s.defaultApproverId &&
      active.has(s.defaultApproverId)
        ? s.defaultApproverId
        : null,
  }));
  const dates = scheduleDates(
    version.scheduleMode,
    steps,
    startDate,
    period,
    await loadWorkingCalendar(tx),
  );
  if (line.plan)
    await tx.contractServicePlan.delete({ where: { id: line.plan.id } });
  const plan = await tx.contractServicePlan.create({
    data: {
      contractServiceId: lineId,
      workflowVersionId: version.id,
      workflowCode: version.template.code,
      workflowVersionNo: version.versionNo,
      scheduleMode: version.scheduleMode,
      startDate,
      period,
      createdById: options.userId ?? null,
      steps: {
        create: steps.map((s) => ({ ...s, ...dates.get(s.stepKey)! })),
      },
      requirements: {
        create: version.requirements.map((r) => ({
          sortOrder: r.sortOrder,
          name: r.name,
          instructions: r.instructions,
          required: r.required,
          category: r.category,
          perPeriod: r.perPeriod,
          stepKey: r.step?.stepKey ?? null,
        })),
      },
    },
  });
  return plan.id;
}

/** Tính lại ngày của mọi bước theo ngày bắt đầu/kỳ và các bước còn lại. */
export async function recomputeDates(tx: Client, planId: string) {
  const plan = await tx.contractServicePlan.findUniqueOrThrow({
    where: { id: planId },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
  const dates = scheduleDates(
    plan.scheduleMode,
    plan.steps,
    plan.startDate,
    plan.period,
    await loadWorkingCalendar(tx),
  );
  for (const step of plan.steps)
    await tx.contractPlanStep.update({
      where: { id: step.id },
      data: dates.get(step.stepKey)!,
    });
}

/**
 * Xác nhận kế hoạch nháp (cập nhật có điều kiện, chỉ một lần thành công). Bước chưa có người thực hiện
 * được điền theo dòng dịch vụ → HĐ → khách hàng.
 */
export async function confirmPlan(
  tx: Client,
  planId: string,
  userId: string | null,
): Promise<void> {
  const plan = await tx.contractServicePlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      steps: true,
      contractService: {
        select: {
          assigneeId: true,
          contract: {
            select: { ownerId: true, customer: { select: { ownerId: true } } },
          },
        },
      },
    },
  });
  if (!plan.steps.some((s) => !s.skipped))
    throw new PlanError('Kế hoạch cần ít nhất một bước được thực hiện');
  const { count } = await tx.contractServicePlan.updateMany({
    where: { id: planId, status: ContractPlanStatus.DRAFT },
    data: {
      status: ContractPlanStatus.CONFIRMED,
      confirmedById: userId,
      confirmedAt: new Date(),
    },
  });
  if (count === 0) throw new PlanError('Kế hoạch đã được xác nhận', 'conflict');
  const line = plan.contractService;
  const fallback =
    line.assigneeId ?? line.contract.ownerId ?? line.contract.customer.ownerId;
  if (fallback)
    await tx.contractPlanStep.updateMany({
      where: { planId, assigneeId: null, skipped: false },
      data: { assigneeId: fallback },
    });
}

export interface PlanStepChange {
  stepKey: string;
  skipped?: boolean;
  assigneeId?: string | null;
  reviewerId?: string | null;
  approverId?: string | null;
  durationDays?: number;
  dueOffsetDays?: number;
}

/** Áp thay đổi lên các bước (không ghi DB); bước lạ hoặc bỏ bước bắt buộc → PlanError. */
export function applyStepChanges<T extends PlanStepInput & { name: string }>(
  steps: T[],
  changes: PlanStepChange[],
): T[] {
  const byKey = new Map(steps.map((s) => [s.stepKey, s]));
  for (const change of changes) {
    const step = byKey.get(change.stepKey);
    if (!step)
      throw new PlanError(`Bước ${change.stepKey} không có trong kế hoạch`);
    if (change.skipped && step.required)
      throw new PlanError(`Bước "${step.name}" là bắt buộc, không bỏ qua được`);
  }
  const patch = new Map(changes.map((c) => [c.stepKey, c]));
  return steps.map((s) => {
    const defined = Object.entries(patch.get(s.stepKey) ?? {}).filter(
      ([key, value]) => key !== 'stepKey' && value !== undefined,
    );
    return { ...s, ...Object.fromEntries(defined) };
  });
}

/**
 * Cảnh báo theo bước nguồn: người thực hiện/kiểm tra mặc định của bước quy trình không còn hoạt động
 * (đã được đề xuất người khác khi lập kế hoạch).
 */
export async function inactiveDefaultWarnings(
  tx: Client,
  sourceStepIds: (string | null)[],
): Promise<Map<string, string>> {
  const ids = sourceStepIds.filter((id): id is string => !!id);
  if (ids.length === 0) return new Map();
  const sources = await tx.workflowStep.findMany({
    where: { id: { in: ids } },
    select: { id: true, defaultAssigneeId: true, defaultReviewerId: true },
  });
  const people = sources.flatMap((s) => [
    s.defaultAssigneeId,
    s.defaultReviewerId,
  ]);
  const active = await activeUserIds(tx, people);
  const inactive = people.filter((id): id is string => !!id && !active.has(id));
  if (inactive.length === 0) return new Map();
  const users = await tx.user.findMany({
    where: { id: { in: inactive } },
    select: { id: true, fullName: true },
  });
  const name = new Map(users.map((u) => [u.id, u.fullName]));
  const warnings = new Map<string, string>();
  for (const s of sources) {
    const parts = [
      s.defaultAssigneeId && !active.has(s.defaultAssigneeId)
        ? `người thực hiện mặc định ${name.get(s.defaultAssigneeId) ?? ''}`.trim()
        : null,
      s.defaultReviewerId && !active.has(s.defaultReviewerId)
        ? `người kiểm tra mặc định ${name.get(s.defaultReviewerId) ?? ''}`.trim()
        : null,
    ].filter(Boolean);
    if (parts.length > 0)
      warnings.set(s.id, `${parts.join(', ')} không còn hoạt động`);
  }
  return warnings;
}
