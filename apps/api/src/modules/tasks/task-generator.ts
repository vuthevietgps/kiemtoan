import {
  ContractPlanStatus,
  DocumentRequestStatus,
  Prisma,
  PrismaClient,
  TaskGenerationStatus,
  TaskStatus,
} from '@prisma/client';
import type { WorkingCalendar } from '../../common/working-calendar';
import { ensureObligationForTask } from '../deadlines/obligation-sync';
import { loadWorkingCalendar } from '../deadlines/working-calendar.loader';
import {
  computeDueDate,
  endOfPeriod,
} from '../service-catalog/workflow-schedule.util';
import { missingDocuments, requestDrafts } from './document-request.rules';
import { generationPeriods } from './task-periods';

/**
 * Tự sinh công việc cho hợp đồng từ kế hoạch thực hiện đã xác nhận của từng dòng dịch vụ
 * (đặc tả 04-B, E1; kế hoạch chụp từ phiên bản quy trình theo 03). File thuần (không phụ thuộc
 * NestJS) để dùng chung cho TasksService và seed.
 */

export { computeDueDate, endOfPeriod };

export interface GeneratedTask {
  id: string;
  title: string;
  assigneeId: string | null;
  /** Chỉ báo người được giao cho việc của kỳ đầu; kỳ sau do nhắc hạn (06) báo khi tới gần. */
  notify: boolean;
}

/** Kỳ dạng 'YYYY-MM' lấy từ một ngày (theo UTC, khớp kiểu cột @db.Date). */
export function periodOfDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Người làm: người phụ trách dòng dịch vụ → người phụ trách HĐ → người phụ trách khách hàng. */
export function pickAssignee(
  serviceAssigneeId: string | null,
  contractOwnerId: string | null,
  customerOwnerId: string | null,
): string | null {
  return serviceAssigneeId ?? contractOwnerId ?? customerOwnerId ?? null;
}

const CONTRACT_FOR_GENERATION = {
  customer: { select: { ownerId: true } },
  services: {
    include: {
      serviceType: { select: { code: true, cycle: true } },
      plan: {
        select: {
          status: true,
          period: true,
          scheduleMode: true,
          steps: {
            where: { skipped: false },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              stepKey: true,
              name: true,
              dueDate: true,
              dueOffsetDays: true,
              plannedStart: true,
              requiresEvidence: true,
              requiresDelivery: true,
              isStatutory: true,
              obligationTypeId: true,
              reviewLevels: true,
              assigneeId: true,
              reviewerId: true,
              approverId: true,
            },
          },
          // Hồ sơ yêu cầu chép từ quy trình (03-C) → hồ sơ cần thu của khách (05-D).
          requirements: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              instructions: true,
              required: true,
              category: true,
              perPeriod: true,
              stepKey: true,
            },
          },
        },
      },
      _count: { select: { tasks: true } },
    },
  },
} satisfies Prisma.ContractInclude;

type ContractForGeneration = Prisma.ContractGetPayload<{
  include: typeof CONTRACT_FOR_GENERATION;
}>;
type ServiceLine = ContractForGeneration['services'][number];

export const WAITING_FOR_PLAN = 'Chờ xác nhận kế hoạch thực hiện';

/** Dòng đang sinh quá lâu (tiến trình dừng giữa chừng) được phép nhận lại. */
const STALE_GENERATION_MS = 10 * 60_000;

/**
 * Nhận quyền sinh việc cho một dòng dịch vụ (đặc tả 04-A): chỉ một tiến trình đổi được trạng thái
 * Chưa sinh/Bỏ qua/Lỗi (hoặc Đang sinh đã quá hạn) sang Đang sinh, nên gọi lại/đồng thời không trùng.
 */
async function claimLine(prisma: PrismaClient, lineId: string) {
  const { count } = await prisma.contractService.updateMany({
    where: {
      id: lineId,
      OR: [
        {
          taskGenerationStatus: {
            in: [
              TaskGenerationStatus.PENDING,
              TaskGenerationStatus.SKIPPED,
              TaskGenerationStatus.FAILED,
            ],
          },
        },
        {
          taskGenerationStatus: TaskGenerationStatus.GENERATING,
          taskGenerationStartedAt: {
            lt: new Date(Date.now() - STALE_GENERATION_MS),
          },
        },
      ],
    },
    data: {
      taskGenerationStatus: TaskGenerationStatus.GENERATING,
      taskGenerationStartedAt: new Date(),
      taskGenerationMessage: null,
    },
  });
  return count === 1;
}

function finishLine(
  prisma: Pick<PrismaClient, 'contractService'>,
  lineId: string,
  status: TaskGenerationStatus,
  message: string | null = null,
) {
  return prisma.contractService.update({
    where: { id: lineId },
    data: {
      taskGenerationStatus: status,
      taskGenerationMessage: message,
      ...(status === TaskGenerationStatus.DONE && {
        tasksGeneratedAt: new Date(),
      }),
    },
  });
}

/** 06 (I6): nghĩa vụ gắn cho việc của bước pháp lý; nhớ theo (loại, kỳ) trong một lần sinh. */
function obligationLinker(
  tx: Prisma.TransactionClient,
  customerId: string,
  calendar: WorkingCalendar,
) {
  const cache = new Map<string, { id: string; dueDate: Date } | null>();
  return async (
    step: { isStatutory: boolean; obligationTypeId: string | null },
    period: string,
  ) => {
    if (!step.isStatutory || !step.obligationTypeId) return null;
    const key = `${step.obligationTypeId}|${period}`;
    if (!cache.has(key))
      cache.set(
        key,
        await ensureObligationForTask(tx, {
          customerId,
          obligationTypeId: step.obligationTypeId,
          taskPeriod: period,
          calendar,
          actorId: null,
        }),
      );
    return cache.get(key)!;
  };
}

/**
 * Sinh việc cho một dòng từ kế hoạch đã xác nhận (đặc tả 04-B), trong một transaction: hoặc đủ việc
 * + Đã sinh, hoặc không gì cả. Mỗi bước kế hoạch × mỗi kỳ (H12, `generationPeriods`) một việc; kỳ của
 * kế hoạch giữ đúng ngày đã lập, kỳ sau dời hạn theo kỳ. (`plan_step_id`, kỳ) unique chặn sinh trùng ở DB.
 * Việc mang theo số cấp soát xét, người kiểm tra/phê duyệt và cờ hạn pháp lý/giao nộp của bước (05-B).
 * 06 (I6): bước pháp lý có loại nghĩa vụ → việc gắn nghĩa vụ của KH cùng kỳ, hạn = hạn nghĩa vụ;
 * hạn nội bộ theo kỳ dời theo lịch làm việc đã xác nhận (I3).
 */
async function generateLine(
  prisma: PrismaClient,
  contract: ContractForGeneration,
  service: ServiceLine,
  calendar: WorkingCalendar,
): Promise<GeneratedTask[] | string> {
  const plan = service.plan!;
  if (plan.steps.length === 0)
    return `Kế hoạch dịch vụ ${service.serviceType.code} không có bước nào để sinh việc`;
  const fallback = pickAssignee(
    service.assigneeId,
    contract.ownerId,
    contract.customer.ownerId,
  );
  const periods = generationPeriods({
    cycle: service.serviceType.cycle,
    scheduleMode: plan.scheduleMode,
    planPeriod: plan.period,
    contractStart: contract.startDate,
    contractEnd: contract.endDate,
  });
  const drafts = requestDrafts(plan.requirements ?? [], periods);
  return prisma.$transaction(
    async (tx) => {
      const created: GeneratedTask[] = [];
      const linkedObligation = obligationLinker(
        tx,
        contract.customerId,
        calendar,
      );
      if (drafts.length)
        await tx.customerDocumentRequest.createMany({
          data: drafts.map((d) => ({
            ...d,
            customerId: contract.customerId,
            contractId: contract.id,
            contractServiceId: service.id,
          })),
        });
      const gate = drafts.map((d) => ({
        ...d,
        status: DocumentRequestStatus.NOT_REQUESTED,
      }));
      for (const period of periods) {
        const own = period === plan.period;
        for (const step of plan.steps) {
          const obligation = await linkedObligation(step, period);
          const dueDate =
            obligation?.dueDate ??
            (own
              ? step.dueDate
              : computeDueDate(period, step.dueOffsetDays ?? 0, calendar));
          // H4: bước còn hồ sơ bắt buộc chưa chấp nhận → Chờ khách hàng cung cấp hồ sơ ngay từ đầu.
          const waiting =
            missingDocuments({ stepKey: step.stepKey, period }, gate).length >
            0;
          const task = await tx.task.create({
            data: {
              customerId: contract.customerId,
              contractId: contract.id,
              contractServiceId: service.id,
              planStepId: step.id,
              obligationId: obligation?.id ?? null,
              title: step.name,
              period,
              dueDate,
              originalDueDate: dueDate,
              plannedStartDate: own ? step.plannedStart : null,
              requiresEvidence: step.requiresEvidence,
              requiresDelivery: step.requiresDelivery,
              isStatutory: step.isStatutory,
              reviewLevels: step.reviewLevels,
              assigneeId: step.assigneeId ?? fallback,
              reviewerId: step.reviewLevels >= 1 ? step.reviewerId : null,
              approverId: step.reviewLevels >= 2 ? step.approverId : null,
              ...(waiting && {
                status: TaskStatus.WAITING_CLIENT,
                clientWaits: {
                  create: {
                    automatic: true,
                    fromStatus: TaskStatus.NOT_STARTED,
                    note: 'Chờ hồ sơ bắt buộc của khách',
                  },
                },
              }),
              statusEvents: {
                create: {
                  toStatus: waiting
                    ? TaskStatus.WAITING_CLIENT
                    : TaskStatus.NOT_STARTED,
                  note: waiting
                    ? 'Sinh từ kế hoạch thực hiện — chờ hồ sơ khách hàng'
                    : 'Sinh từ kế hoạch thực hiện',
                },
              },
            },
            select: { id: true, title: true, assigneeId: true },
          });
          created.push({ ...task, notify: period === periods[0] });
        }
      }
      await finishLine(tx, service.id, TaskGenerationStatus.DONE);
      return created;
    },
    { timeout: 60_000 },
  );
}

/**
 * Sinh công việc cho các dòng dịch vụ đã có kế hoạch xác nhận và chưa được sinh (đặc tả 04-A/B, E1).
 * Mỗi dòng ghi trạng thái: Đã sinh, Bỏ qua (kế hoạch rỗng, báo qua `onSkip`) hoặc Lỗi kèm thông báo;
 * lỗi một dòng không chặn dòng khác. Hạn và người làm lấy từ kế hoạch đã xác nhận.
 */
export async function generateTasks(
  prisma: PrismaClient,
  contractId: string,
  onSkip?: (message: string) => void,
): Promise<GeneratedTask[]> {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, deletedAt: null },
    include: CONTRACT_FOR_GENERATION,
  });
  if (!contract) return [];
  const calendar = await loadWorkingCalendar(prisma);

  const created: GeneratedTask[] = [];
  for (const service of contract.services) {
    // E1: chỉ sinh khi kế hoạch đã xác nhận; dòng chưa sinh thì ghi lý do chờ.
    if (service.plan?.status !== ContractPlanStatus.CONFIRMED) {
      if (service.taskGenerationStatus === TaskGenerationStatus.PENDING)
        await prisma.contractService.update({
          where: { id: service.id },
          data: { taskGenerationMessage: WAITING_FOR_PLAN },
        });
      continue;
    }
    if (!(await claimLine(prisma, service.id))) continue;
    if (service._count.tasks > 0) {
      // Dòng đã có việc từ trước (dữ liệu cũ): không sinh thêm.
      await finishLine(prisma, service.id, TaskGenerationStatus.DONE);
      continue;
    }
    try {
      const result = await generateLine(prisma, contract, service, calendar);
      if (typeof result === 'string') {
        onSkip?.(result);
        await finishLine(
          prisma,
          service.id,
          TaskGenerationStatus.SKIPPED,
          result,
        );
      } else {
        created.push(...result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await finishLine(
        prisma,
        service.id,
        TaskGenerationStatus.FAILED,
        `Lỗi khi sinh việc: ${message.slice(0, 500)}`,
      );
    }
  }
  return created;
}

/** Sinh công việc cho hợp đồng, trả về số việc đã tạo. */
export async function generateTasksForContract(
  prisma: PrismaClient,
  contractId: string,
): Promise<number> {
  return (await generateTasks(prisma, contractId)).length;
}
