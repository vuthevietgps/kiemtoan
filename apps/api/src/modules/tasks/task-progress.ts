import {
  ContractStatus,
  PrismaClient,
  ServiceStatus,
  TaskStatus,
} from '@prisma/client';

export interface ProgressTask {
  period: string | null;
  status: TaskStatus;
  /** Việc của bước bắt buộc (việc phát sinh, không có bước, coi là bắt buộc). */
  required: boolean;
}

export interface PeriodProgress {
  period: string | null;
  total: number;
  completed: number;
  done: boolean;
}

/**
 * Tiến độ theo kỳ (đặc tả 05-C): kỳ hoàn tất khi mọi việc bắt buộc của kỳ Hoàn thành; kỳ chỉ có
 * việc tuỳ chọn thì xét mọi việc. Sắp theo kỳ.
 */
export function periodProgress(tasks: ProgressTask[]): PeriodProgress[] {
  const byPeriod = new Map<string | null, ProgressTask[]>();
  for (const t of tasks)
    byPeriod.set(t.period, [...(byPeriod.get(t.period) ?? []), t]);
  return [...byPeriod.entries()]
    .map(([period, list]) => {
      const counted = list.some((t) => t.required)
        ? list.filter((t) => t.required)
        : list;
      const completed = counted.filter(
        (t) => t.status === TaskStatus.COMPLETED,
      ).length;
      return {
        period,
        total: counted.length,
        completed,
        done: completed === counted.length,
      };
    })
    .sort((a, b) => (a.period ?? '').localeCompare(b.period ?? ''));
}

/**
 * Cập nhật tiến độ dòng dịch vụ và hợp đồng sau khi công việc đổi trạng thái:
 * - có việc bắt đầu → dòng dịch vụ / HĐ đang "Chưa thực hiện" chuyển "Đang thực hiện";
 * - mọi kỳ của dòng dịch vụ hoàn tất (việc bắt buộc Hoàn thành) → dòng dịch vụ hoàn thành;
 * - mọi dòng dịch vụ hoàn thành → HĐ hoàn thành;
 * - việc hoàn thành bị mở lại → dòng dịch vụ / HĐ quay về "Đang thực hiện".
 */
export async function syncProgress(
  prisma: PrismaClient,
  task: { contractId: string | null; contractServiceId: string | null },
): Promise<void> {
  if (!task.contractId) return;
  if (task.contractServiceId) {
    const tasks = await prisma.task.findMany({
      where: { contractServiceId: task.contractServiceId, deletedAt: null },
      select: {
        status: true,
        period: true,
        planStep: { select: { required: true } },
      },
    });
    const periods = periodProgress(
      tasks.map((t) => ({
        period: t.period,
        status: t.status,
        required: t.planStep?.required ?? true,
      })),
    );
    const allDone = periods.length > 0 && periods.every((p) => p.done);
    const anyStarted = tasks.some((t) => t.status !== TaskStatus.NOT_STARTED);
    const service = await prisma.contractService.findUnique({
      where: { id: task.contractServiceId },
      select: { status: true },
    });
    let next: ServiceStatus | null = null;
    if (allDone) next = ServiceStatus.COMPLETED;
    else if (anyStarted || service?.status === ServiceStatus.COMPLETED) {
      next = ServiceStatus.IN_PROGRESS;
    }
    if (service && next && service.status !== next) {
      await prisma.contractService.update({
        where: { id: task.contractServiceId },
        data: { status: next },
      });
    }
  }
  await syncContract(prisma, task.contractId);
}

async function syncContract(
  prisma: PrismaClient,
  contractId: string,
): Promise<void> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      status: true,
      services: { select: { status: true } },
      tasks: {
        where: { deletedAt: null, status: { not: TaskStatus.NOT_STARTED } },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!contract) return;
  const trackable: ContractStatus[] = [
    ContractStatus.NOT_STARTED,
    ContractStatus.IN_PROGRESS,
    ContractStatus.COMPLETED,
  ];
  if (!trackable.includes(contract.status)) return;

  const allCompleted =
    contract.services.length > 0 &&
    contract.services.every((s) => s.status === ServiceStatus.COMPLETED);
  let next: ContractStatus = contract.status;
  if (allCompleted) next = ContractStatus.COMPLETED;
  else if (
    contract.tasks.length > 0 ||
    contract.status === ContractStatus.COMPLETED
  ) {
    next = ContractStatus.IN_PROGRESS;
  }
  if (next !== contract.status) {
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: next },
    });
  }
}
