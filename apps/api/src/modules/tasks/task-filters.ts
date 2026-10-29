import { DocumentCategory, Prisma, TaskStatus } from '@prisma/client';
import {
  customerScope,
  dataScopeOf,
  taskScope,
} from '../../core/access-control/data-scope';
import { AuthUser } from '../../core/auth/auth-user.interface';
import {
  DueFilter,
  MyTab,
  TaskQueryDto,
  TaskStatusFilter,
} from './dto/task.dto';
import { OPEN_STATUSES } from './task-status.rules';
import {
  DEFAULT_THRESHOLDS,
  thresholdsFor,
  urgencyOf,
  type UrgencyConfig,
} from '../deadlines/urgency';
import { todayVn } from '../reports/utils/period.util';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Hôm nay (theo giờ máy chủ) dạng UTC 00:00 — khớp cột dueDate kiểu @db.Date. */
export function todayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** [đầu tháng, đầu tháng sau) của tháng hiện tại, UTC. */
export function currentMonthRange(now: Date = new Date()): {
  gte: Date;
  lt: Date;
} {
  return {
    gte: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)),
    lt: new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1)),
  };
}

export const EVIDENCE_DOC_WHERE = {
  category: DocumentCategory.EVIDENCE,
  deletedAt: null,
} satisfies Prisma.DocumentWhereInput;

export const OPEN_WHERE = {
  status: { in: OPEN_STATUSES },
} satisfies Prisma.TaskWhereInput;

export const COMPLETED_THIS_MONTH = (now?: Date): Prisma.TaskWhereInput => ({
  status: TaskStatus.COMPLETED,
  completedAt: currentMonthRange(now),
});

export function overdueWhere(now?: Date): Prisma.TaskWhereInput {
  return { ...OPEN_WHERE, dueDate: { lt: todayUtc(now) } };
}

export const MISSING_EVIDENCE_WHERE = {
  requiresEvidence: true,
  documents: { none: EVIDENCE_DOC_WHERE },
} satisfies Prisma.TaskWhereInput;

/**
 * Việc người dùng được xem: phạm vi việc, cộng việc họ được chỉ định kiểm tra/phê duyệt nhưng chỉ
 * khi khách hàng nằm trong phạm vi của họ (đặc tả 05 — giữ nguyên tắc F6, không mở rộng phạm vi KH).
 */
export function visibleTaskWhere(user: AuthUser): Prisma.TaskWhereInput {
  if (dataScopeOf(user) === 'ALL') return {};
  return {
    OR: [
      taskScope(user),
      {
        AND: [
          { OR: [{ reviewerId: user.id }, { approverId: user.id }] },
          { customer: customerScope(user) },
        ],
      },
    ],
  };
}

/** Điều kiện gốc: chưa xoá + trong phạm vi dữ liệu (+ chỉ việc của tôi). */
export function baseTaskWhere(
  user: AuthUser,
  mine?: boolean,
): Prisma.TaskWhereInput[] {
  const and: Prisma.TaskWhereInput[] = [
    { deletedAt: null },
    visibleTaskWhere(user),
  ];
  if (mine) and.push({ assigneeId: user.id });
  return and;
}

function statusWhere(status: TaskStatusFilter): Prisma.TaskWhereInput {
  return status === 'OPEN' ? OPEN_WHERE : { status };
}

/**
 * Bộ lọc hạn: overdue = quá hạn chưa làm xong; today = hạn hôm nay;
 * week = hạn trong 7 ngày tới (kể cả hôm nay); month = hạn trong tháng này.
 */
export function dueWhere(due: DueFilter, now?: Date): Prisma.TaskWhereInput {
  const today = todayUtc(now);
  switch (due) {
    case 'overdue':
      return overdueWhere(now);
    case 'today':
      return { dueDate: today };
    case 'week':
      return { dueDate: { gte: today, lt: addDays(today, 7) } };
    case 'month':
      return { dueDate: currentMonthRange(now) };
  }
}

/** Việc của tôi (05-E): Hôm nay / Sắp đến hạn (≤ 7 ngày) / Quá hạn / Đã hoàn thành. */
export function myTabWhere(tab: MyTab, now?: Date): Prisma.TaskWhereInput {
  const today = todayUtc(now);
  switch (tab) {
    case 'today':
      return { ...OPEN_WHERE, dueDate: today };
    case 'upcoming':
      return { ...OPEN_WHERE, dueDate: { gt: today, lte: addDays(today, 7) } };
    case 'overdue':
      return overdueWhere(now);
    case 'done':
      return { status: TaskStatus.COMPLETED };
  }
}

export function buildTaskWhere(
  user: AuthUser,
  query: TaskQueryDto,
): Prisma.TaskWhereInput {
  const and = baseTaskWhere(user, query.mine);
  if (query.status) and.push(statusWhere(query.status));
  if (query.customerId) and.push({ customerId: query.customerId });
  if (query.contractId) and.push({ contractId: query.contractId });
  if (query.contractServiceId) {
    and.push({ contractServiceId: query.contractServiceId });
  }
  if (query.assigneeId) and.push({ assigneeId: query.assigneeId });
  if (query.period) and.push({ period: query.period });
  if (query.due) and.push(dueWhere(query.due));
  if (query.missingEvidence) and.push(MISSING_EVIDENCE_WHERE);
  if (query.completedThisMonth) and.push(COMPLETED_THIS_MONTH());
  if (query.reviewerId)
    and.push({
      OR: [{ reviewerId: query.reviewerId }, { approverId: query.reviewerId }],
    });
  if (query.priority) and.push({ priority: query.priority });
  if (query.statutory) and.push({ isStatutory: true });
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    and.push({
      OR: [
        { title: contains },
        { customer: { name: contains } },
        { contract: { code: contains } },
      ],
    });
  }
  return { AND: and };
}

export const TASK_LIST_INCLUDE = {
  customer: { select: { id: true, name: true } },
  contract: { select: { id: true, code: true } },
  contractService: {
    select: { id: true, serviceType: { select: { id: true, name: true } } },
  },
  assignee: { select: { id: true, fullName: true } },
  _count: { select: { documents: { where: EVIDENCE_DOC_WHERE } } },
} satisfies Prisma.TaskInclude;

type TaskWithListInclude = Prisma.TaskGetPayload<{
  include: typeof TASK_LIST_INCLUDE;
}>;

/** Một dòng trong danh sách công việc. */
export function toTaskRow(
  task: TaskWithListInclude,
  now?: Date,
  waitingFor: string[] = [],
  urgency?: UrgencyConfig,
) {
  const { _count, contractService, ...rest } = task;
  return {
    /** 06 (I11): mức gấp theo số ngày còn lại và ngưỡng của dịch vụ; việc đã xong không có. */
    urgency:
      task.status === TaskStatus.COMPLETED
        ? null
        : urgencyOf(
            task.dueDate,
            todayVn(now),
            urgency
              ? thresholdsFor(urgency, contractService?.serviceType.id)
              : DEFAULT_THRESHOLDS,
          ),
    ...rest,
    serviceTypeName: contractService?.serviceType.name ?? null,
    evidenceCount: _count.documents,
    isOverdue:
      task.status !== TaskStatus.COMPLETED && task.dueDate < todayUtc(now),
    /** H6: bước trước cùng kỳ chưa xong → nhãn "Chưa đủ điều kiện" (chỉ việc Chưa bắt đầu). */
    waitingFor: task.status === TaskStatus.NOT_STARTED ? waitingFor : [],
  };
}

export type TaskRow = ReturnType<typeof toTaskRow>;
