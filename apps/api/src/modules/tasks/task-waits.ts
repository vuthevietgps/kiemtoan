import { ConflictException } from '@nestjs/common';
import { Prisma, Task, TaskStatus } from '@prisma/client';
import { missingDocuments } from './document-request.rules';

/**
 * Khoảng chờ khách (đặc tả 05-D, H4, G5): vào/ra Chờ khách luôn mở/đóng một khoảng chờ và ghi lịch
 * sử trạng thái. Dùng chung cho chờ tay, hồ sơ "Cần bổ sung", tự mở lại khi hồ sơ bắt buộc đủ.
 */

type Tx = Prisma.TransactionClient;

const CONFLICT =
  'Việc vừa được người khác cập nhật; tải lại để xem trạng thái mới';

/** Trạng thái được đưa về Chờ khách (bước chưa xong, chưa nộp soát xét). */
export const WAITABLE: TaskStatus[] = [
  TaskStatus.NOT_STARTED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.CHANGES_REQUESTED,
];

export async function enterWait(
  tx: Tx,
  task: Pick<Task, 'id' | 'status'>,
  options: {
    automatic: boolean;
    requestId?: string | null;
    note?: string | null;
    actorId: string | null;
  },
): Promise<void> {
  const { count } = await tx.task.updateMany({
    where: { id: task.id, status: task.status, deletedAt: null },
    data: { status: TaskStatus.WAITING_CLIENT },
  });
  if (!count) throw new ConflictException(CONFLICT);
  await tx.taskClientWait.create({
    data: {
      taskId: task.id,
      automatic: options.automatic,
      fromStatus: task.status,
      requestId: options.requestId ?? null,
      note: options.note ?? null,
    },
  });
  await tx.taskStatusEvent.create({
    data: {
      taskId: task.id,
      fromStatus: task.status,
      toStatus: TaskStatus.WAITING_CLIENT,
      actorId: options.actorId,
      note: options.note ?? null,
    },
  });
}

/** Đóng khoảng chờ đang mở và trả việc về trạng thái trước khi chờ. */
export async function leaveWait(
  tx: Tx,
  taskId: string,
  actorId: string | null,
  note: string | null,
): Promise<TaskStatus> {
  const wait = await tx.taskClientWait.findFirst({
    where: { taskId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  const to = wait?.fromStatus ?? TaskStatus.NOT_STARTED;
  const { count } = await tx.task.updateMany({
    where: { id: taskId, status: TaskStatus.WAITING_CLIENT, deletedAt: null },
    data: { status: to },
  });
  if (!count) throw new ConflictException(CONFLICT);
  if (wait)
    await tx.taskClientWait.update({
      where: { id: wait.id },
      data: { endedAt: new Date() },
    });
  await tx.taskStatusEvent.create({
    data: {
      taskId,
      fromStatus: TaskStatus.WAITING_CLIENT,
      toStatus: to,
      actorId,
      note,
    },
  });
  return to;
}

const GATE_SELECT = {
  name: true,
  stepKey: true,
  period: true,
  perPeriod: true,
  required: true,
  status: true,
} satisfies Prisma.CustomerDocumentRequestSelect;

/** Hồ sơ bắt buộc còn thiếu của một việc (theo bước kế hoạch và kỳ). */
export async function missingFor(
  prisma: Pick<Tx, 'customerDocumentRequest' | 'contractPlanStep'>,
  task: Pick<Task, 'contractServiceId' | 'planStepId' | 'period'>,
): Promise<string[]> {
  if (!task.contractServiceId || !task.planStepId) return [];
  const step = await prisma.contractPlanStep.findUnique({
    where: { id: task.planStepId },
    select: { stepKey: true },
  });
  if (!step) return [];
  const requests = await prisma.customerDocumentRequest.findMany({
    where: { contractServiceId: task.contractServiceId, stepKey: step.stepKey },
    select: GATE_SELECT,
  });
  return missingDocuments(
    { stepKey: step.stepKey, period: task.period },
    requests,
  );
}

/**
 * Hồ sơ vừa "Đã chấp nhận": các việc cùng bước (cùng kỳ, hoặc mọi kỳ nếu hồ sơ một lần) đang Chờ khách
 * do hồ sơ (tự động hoặc chờ tay gắn đúng hồ sơ này) mà đã đủ hồ sơ bắt buộc thì tự mở lại.
 */
export async function resumeReadyTasks(
  tx: Tx,
  request: {
    id: string;
    contractServiceId: string | null;
    stepKey: string | null;
    period: string | null;
    perPeriod: boolean;
  },
  actorId: string,
): Promise<Pick<Task, 'id' | 'title' | 'assigneeId'>[]> {
  if (!request.contractServiceId || !request.stepKey) return [];
  const tasks = await tx.task.findMany({
    where: {
      contractServiceId: request.contractServiceId,
      status: TaskStatus.WAITING_CLIENT,
      deletedAt: null,
      planStep: { stepKey: request.stepKey },
      ...(request.perPeriod && { period: request.period }),
    },
    select: {
      id: true,
      title: true,
      assigneeId: true,
      period: true,
      planStepId: true,
      contractServiceId: true,
      clientWaits: {
        where: { endedAt: null },
        select: { automatic: true, requestId: true },
      },
    },
  });
  const resumed: Pick<Task, 'id' | 'title' | 'assigneeId'>[] = [];
  for (const task of tasks) {
    const open = task.clientWaits[0];
    const byDocuments =
      !open || open.automatic || open.requestId === request.id;
    if (!byDocuments || (await missingFor(tx, task)).length) continue;
    await leaveWait(tx, task.id, actorId, 'Hồ sơ bắt buộc đã được chấp nhận');
    resumed.push(task);
  }
  return resumed;
}
