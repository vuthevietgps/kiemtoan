import { Prisma, TaskStatus } from '@prisma/client';
import { activeSteps } from '../contracts/contract-plan.builder';

/**
 * Điều kiện phụ thuộc giữa bước (đặc tả 05, H6): việc chỉ bắt đầu được khi việc **cùng kỳ** của các
 * bước nó chờ đã ở Đã phê duyệt hoặc Hoàn thành. Bước bị bỏ qua được nối thẳng tới bước nó chờ
 * (như lập lịch 04-B). Bước chờ chưa có việc (dữ liệu cũ, đã xoá) không chặn.
 */

export const DEPENDENCY_SATISFIED: TaskStatus[] = [
  TaskStatus.APPROVED,
  TaskStatus.COMPLETED,
];

export interface PlanStepNode {
  id: string;
  planId: string;
  stepKey: string;
  name: string;
  skipped: boolean;
  required: boolean;
  durationDays: number | null;
  dueOffsetDays: number | null;
  dependsOn: string[];
}

export interface DependentTask {
  id: string;
  planStepId: string | null;
  period: string | null;
}

/** Trạng thái việc theo khoá `${planStepId}|${period}`. */
export type TaskStatusIndex = Map<string, TaskStatus>;

const key = (planStepId: string, period: string | null) =>
  `${planStepId}|${period ?? ''}`;

/** Bước (id) mà mỗi bước kế hoạch thực sự chờ, sau khi bỏ bước bị bỏ qua. */
export function effectivePrerequisites(steps: PlanStepNode[]) {
  const byPlan = new Map<string, PlanStepNode[]>();
  for (const s of steps)
    byPlan.set(s.planId, [...(byPlan.get(s.planId) ?? []), s]);
  const result = new Map<string, PlanStepNode[]>();
  for (const planSteps of byPlan.values()) {
    const byKey = new Map(planSteps.map((s) => [s.stepKey, s]));
    for (const active of activeSteps(planSteps))
      result.set(
        active.id,
        active.dependsOn
          .map((k) => byKey.get(k))
          .filter((s): s is PlanStepNode => !!s),
      );
  }
  return result;
}

/** Tên các bước trước chưa xong của từng việc (rỗng = đủ điều kiện). */
export function unmetPrerequisites(
  tasks: DependentTask[],
  prerequisites: Map<string, PlanStepNode[]>,
  statuses: TaskStatusIndex,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const task of tasks) {
    if (!task.planStepId) continue;
    const waiting = (prerequisites.get(task.planStepId) ?? [])
      .filter((step) => {
        const status = statuses.get(key(step.id, task.period));
        return status !== undefined && !DEPENDENCY_SATISFIED.includes(status);
      })
      .map((step) => step.name);
    if (waiting.length) result.set(task.id, waiting);
  }
  return result;
}

type Client = Pick<Prisma.TransactionClient, 'contractPlanStep' | 'task'>;

const STEP_SELECT = {
  id: true,
  planId: true,
  stepKey: true,
  name: true,
  skipped: true,
  required: true,
  durationDays: true,
  dueOffsetDays: true,
  dependsOn: true,
} satisfies Prisma.ContractPlanStepSelect;

/** Đọc DB và trả các bước trước chưa xong cho một nhóm việc (danh sách, chi tiết, bắt đầu). */
export async function loadUnmetPrerequisites(
  prisma: Client,
  tasks: DependentTask[],
): Promise<Map<string, string[]>> {
  const stepIds = [
    ...new Set(
      tasks.map((t) => t.planStepId).filter((id): id is string => !!id),
    ),
  ];
  if (stepIds.length === 0) return new Map();
  const steps = await prisma.contractPlanStep.findMany({
    where: { plan: { steps: { some: { id: { in: stepIds } } } } },
    select: STEP_SELECT,
  });
  const prerequisites = effectivePrerequisites(steps);
  const needed = [
    ...new Set(
      stepIds.flatMap((id) => (prerequisites.get(id) ?? []).map((s) => s.id)),
    ),
  ];
  if (needed.length === 0) return new Map();
  const periods = [
    ...new Set(tasks.map((t) => t.period).filter((p): p is string => !!p)),
  ];
  const rows = await prisma.task.findMany({
    where: {
      planStepId: { in: needed },
      period: { in: periods },
      deletedAt: null,
    },
    select: { planStepId: true, period: true, status: true },
  });
  const statuses: TaskStatusIndex = new Map(
    rows.map((r) => [key(r.planStepId!, r.period), r.status]),
  );
  return unmetPrerequisites(tasks, prerequisites, statuses);
}
