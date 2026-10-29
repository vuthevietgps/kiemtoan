import {
  ContractStatus,
  DocumentCategory,
  PrismaClient,
  Role,
  ServiceStatus,
  Task,
  TaskReviewDecision,
  TaskStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  confirmPlan,
  createPlan,
  PlanError,
} from '../../src/modules/contracts/contract-plan.builder';
import { generateTasks } from '../../src/modules/tasks/task-generator';

// Dữ liệu demo cho module tasks (agent C). Chạy sau seedContracts.

const DAY_MS = 24 * 60 * 60 * 1000;
const SKIPPED: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.PENDING_APPROVAL,
  ContractStatus.CANCELLED,
];

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

const addDays = (d: Date, days: number) =>
  new Date(d.getTime() + days * DAY_MS);

/** Ghi file bằng chứng giả, đặt tên giống StorageService (YYYY/MM/uuid.ext). */
async function writeFakeEvidence(
  title: string,
): Promise<{ storedName: string; size: number }> {
  const root = resolve(process.env.UPLOAD_DIR ?? 'uploads');
  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const storedName = `${folder}/${randomUUID()}.txt`;
  const content = Buffer.from(
    `Bằng chứng demo cho công việc: ${title}\n`,
    'utf8',
  );
  await mkdir(join(root, folder), { recursive: true });
  await writeFile(join(root, storedName), content);
  return { storedName, size: content.length };
}

async function markDone(
  prisma: PrismaClient,
  task: Task,
  fallbackUserId: string,
): Promise<void> {
  const completedAt = addDays(task.dueDate, -2);
  const submittedAt = addDays(completedAt, -1);
  const startedAt = addDays(completedAt, -3);
  // Việc cần soát xét: gửi kiểm tra rồi được chấp nhận đủ cấp (05-B), có lịch sử tương ứng.
  const reviewers = [task.reviewerId, task.approverId]
    .slice(0, task.reviewLevels)
    .map((id) => id ?? fallbackUserId);
  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.COMPLETED,
      startedAt,
      firstSubmittedAt: submittedAt,
      acceptedAt: completedAt,
      completedAt,
      progress: 100,
      ...(reviewers.length && {
        approvedById: reviewers[reviewers.length - 1],
        approvedAt: completedAt,
      }),
      statusEvents: {
        create: [
          {
            fromStatus: TaskStatus.NOT_STARTED,
            toStatus: TaskStatus.IN_PROGRESS,
            actorId: task.assigneeId,
            occurredAt: startedAt,
          },
          ...(reviewers.length
            ? [
                {
                  fromStatus: TaskStatus.IN_PROGRESS,
                  toStatus: TaskStatus.IN_REVIEW,
                  actorId: task.assigneeId,
                  occurredAt: submittedAt,
                },
              ]
            : []),
          {
            fromStatus: reviewers.length
              ? TaskStatus.IN_REVIEW
              : TaskStatus.IN_PROGRESS,
            toStatus: TaskStatus.COMPLETED,
            actorId: reviewers[reviewers.length - 1] ?? task.assigneeId,
            occurredAt: completedAt,
          },
        ],
      },
      reviews: {
        create: reviewers.map((reviewerId, i) => ({
          level: i + 1,
          reviewerId,
          decision: TaskReviewDecision.ACCEPT,
          enteredAt: submittedAt,
          decidedAt: completedAt,
        })),
      },
    },
  });
  if (!task.requiresEvidence) return;
  const file = await writeFakeEvidence(task.title);
  await prisma.document.create({
    data: {
      customerId: task.customerId,
      contractId: task.contractId,
      taskId: task.id,
      category: DocumentCategory.EVIDENCE,
      period: task.period,
      fileName: `bang-chung-${task.period ?? 'demo'}.txt`,
      storedName: file.storedName,
      mimeType: 'text/plain',
      size: file.size,
      uploadedById: task.assigneeId ?? fallbackUserId,
    },
  });
}

/** HĐ đang thực hiện: ~nửa số việc Đã làm / Đang làm, còn lại Chưa làm; có việc quá hạn và việc hạn hôm nay. */
async function seedInProgress(
  prisma: PrismaClient,
  tasks: Task[],
  fallbackUserId: string,
): Promise<void> {
  const half = Math.ceil(tasks.length / 2);
  const today = todayUtc();
  for (const [i, task] of tasks.entries()) {
    if (i < half) {
      if (i % 2 === 0) await markDone(prisma, task, fallbackUserId);
      else {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.IN_PROGRESS,
            startedAt: addDays(today, -2),
            progress: 50,
          },
        });
      }
      continue;
    }
    // Việc chưa làm: việc đầu quá hạn, việc kế hạn hôm nay, việc sau hạn trong tuần.
    const offset = [-3, 0, 4][i - half];
    if (offset !== undefined) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          dueDate: addDays(today, offset),
          originalDueDate: addDays(today, offset),
        },
      });
    }
  }
}

async function syncServiceStatuses(
  prisma: PrismaClient,
  contractId: string,
): Promise<void> {
  const services = await prisma.contractService.findMany({
    where: { contractId },
    select: { id: true, tasks: { select: { status: true } } },
  });
  for (const s of services) {
    if (s.tasks.length === 0) continue;
    const allDone = s.tasks.every((t) => t.status === TaskStatus.COMPLETED);
    const started = s.tasks.some((t) => t.status !== TaskStatus.NOT_STARTED);
    const status = allDone
      ? ServiceStatus.COMPLETED
      : started
        ? ServiceStatus.IN_PROGRESS
        : ServiceStatus.NOT_STARTED;
    await prisma.contractService.update({
      where: { id: s.id },
      data: { status },
    });
  }
}

async function seedNotifications(
  prisma: PrismaClient,
  taskIds: string[],
): Promise<void> {
  const tasks = await prisma.task.findMany({
    where: {
      id: { in: taskIds },
      assigneeId: { not: null },
      status: { not: TaskStatus.COMPLETED },
    },
    orderBy: { dueDate: 'asc' },
  });
  const perUser = new Map<string, number>();
  for (const task of tasks) {
    const userId = task.assigneeId as string;
    const n = perUser.get(userId) ?? 0;
    if (n >= 4) continue;
    perUser.set(userId, n + 1);
    await prisma.notification.create({
      data: {
        userId,
        title: `Bạn được giao việc: ${task.title}`,
        link: `/tasks?id=${task.id}`,
        readAt: n >= 2 ? new Date() : null,
      },
    });
  }
}

export async function seedTasks(prisma: PrismaClient): Promise<void> {
  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null, status: { notIn: SKIPPED } },
    select: { id: true, status: true },
    orderBy: { code: 'asc' },
  });
  if (contracts.length === 0) return;
  const director = await prisma.user.findFirst({
    where: { role: Role.DIRECTOR },
  });
  if (!director) return;

  const createdIds: string[] = [];
  for (const contract of contracts) {
    await seedPlans(prisma, contract.id, director.id);
    const created = await generateTasks(prisma, contract.id);
    if (created.length === 0) continue; // đã seed trước đó
    createdIds.push(...created.map((t) => t.id));
    const tasks = await prisma.task.findMany({
      where: { id: { in: created.map((t) => t.id) } },
      orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
    });
    if (
      contract.status === ContractStatus.COMPLETED ||
      contract.status === ContractStatus.LIQUIDATED
    ) {
      for (const task of tasks) await markDone(prisma, task, director.id);
    } else if (contract.status === ContractStatus.IN_PROGRESS) {
      await seedInProgress(prisma, tasks, director.id);
    }
    await syncServiceStatuses(prisma, contract.id);
  }
  await seedNotifications(prisma, createdIds);
}

/** Đặc tả 04-B (E1): việc chỉ sinh từ kế hoạch đã xác nhận; seed lập và xác nhận kế hoạch mặc định. */
async function seedPlans(
  prisma: PrismaClient,
  contractId: string,
  directorId: string,
): Promise<void> {
  const lines = await prisma.contractService.findMany({
    where: { contractId, plan: null },
    select: { id: true },
  });
  for (const line of lines) {
    try {
      await prisma.$transaction(async (tx) => {
        const planId = await createPlan(tx, line.id, { userId: directorId });
        await confirmPlan(tx, planId, directorId);
      });
    } catch (err) {
      if (!(err instanceof PlanError)) throw err; // dịch vụ chưa có quy trình: bỏ qua
    }
  }
}
