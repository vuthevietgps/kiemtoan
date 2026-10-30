import {
  NotificationKind,
  NotificationSeverity,
  ObligationStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import type { WorkingCalendar } from '../../common/working-calendar';
import {
  effectivePermissions,
  hasPermission,
} from '../../core/access-control/permissions';
import { lineTeam } from '../contracts/service-teams/line-team';
import { thresholdsFor, type UrgencyConfig } from '../deadlines/urgency';
import {
  addWorkingDays,
  countWorkingDays,
} from '../service-catalog/workflow-schedule.util';
import { vietnamDate, workingDaysWaited } from '../tasks/review-sla';
import {
  CATCH_UP_DAYS,
  currentMilestone,
  fmtDate,
  REVIEW_ESCALATION_EXTRA_DAYS,
  REVIEW_SLA_DAYS,
  reminderTitle,
} from './reminder.rules';

/**
 * Lập danh sách nhắc cần gửi tại một thời điểm (đặc tả 06, I9/I13): mốc hạn việc và lịch báo cáo,
 * leo thang quá hạn, soát xét quá SLA, bản tin buổi sáng. Chỉ đọc DB; ghi và gửi do ReminderService.
 */

type Db = Prisma.TransactionClient;
const DAY_MS = 86_400_000;

export interface PlannedReminder {
  subjectType: 'TASK' | 'OBLIGATION' | 'USER' | 'CREDENTIAL';
  subjectId: string;
  milestone: string;
  dueKey: Date;
  userIds: (string | null | undefined)[];
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  link: string;
  email: boolean;
}

export interface PlanContext {
  now: Date;
  today: Date;
  calendar: WorkingCalendar;
  urgency: UrgencyConfig;
  escalationWorkingDays: number;
}

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);
const within = (date: Date, today: Date) =>
  date <= today && date >= addDays(today, -CATCH_UP_DAYS);
const taskLink = (id: string) => `/tasks?id=${id}`;

/** Người nhận nhắc của việc: đang soát xét → người kiểm tra/phê duyệt cấp hiện tại; còn lại → người làm. */
function taskOwner(task: {
  status: TaskStatus;
  reviewLevel: number | null;
  reviewerId: string | null;
  approverId: string | null;
  assigneeId: string | null;
}) {
  if (task.status !== TaskStatus.IN_REVIEW) return task.assigneeId;
  return task.reviewLevel === 2 ? task.approverId : task.reviewerId;
}

/**
 * Quản lý nhận leo thang: Manager nhóm dòng dịch vụ (H8/04-F); không có thì người phụ trách/phân công
 * KH có `tasks:approve` hiệu lực.
 */
export function managerResolver(db: Db) {
  const cache = new Map<string, string[]>();
  return async (customerId: string, contractServiceId: string | null) => {
    if (contractServiceId) {
      const team = await lineTeam(db, contractServiceId);
      if (team?.managerId) return [team.managerId];
    }
    if (!cache.has(customerId)) {
      const customer = await db.customer.findUnique({
        where: { id: customerId },
        select: {
          ownerId: true,
          assignments: { where: { deletedAt: null }, select: { userId: true } },
        },
      });
      const ids = [
        customer?.ownerId,
        ...(customer?.assignments.map((a) => a.userId) ?? []),
      ].filter((id): id is string => !!id);
      const users = await db.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          role: true,
          financialAccess: true,
          secretAccess: true,
          accessRole: { select: { permissions: true, deletedAt: true } },
        },
      });
      cache.set(
        customerId,
        users
          .filter((u) =>
            hasPermission(
              { role: u.role, permissions: effectivePermissions(u) },
              'tasks',
              'approve',
            ),
          )
          .map((u) => u.id),
      );
    }
    return cache.get(customerId)!;
  };
}

/** Mốc hạn và leo thang quá hạn của việc chưa hoàn thành, không tạm dừng. */
export async function planTaskReminders(
  db: Db,
  ctx: PlanContext,
): Promise<PlannedReminder[]> {
  const tasks = await db.task.findMany({
    where: {
      deletedAt: null,
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.ON_HOLD] },
      dueDate: { gte: addDays(ctx.today, -60), lte: addDays(ctx.today, 91) },
    },
    include: {
      customer: { select: { name: true } },
      contractService: { select: { serviceTypeId: true } },
    },
  });
  const managers = managerResolver(db);
  const planned: PlannedReminder[] = [];
  for (const task of tasks) {
    const subject = `${task.title}${task.period ? ` (${task.period})` : ''} — ${task.customer.name}`;
    const thresholds = thresholdsFor(
      ctx.urgency,
      task.contractService?.serviceTypeId,
    );
    const m = currentMilestone(task.dueDate, ctx.today, thresholds);
    if (m)
      planned.push({
        subjectType: 'TASK',
        subjectId: task.id,
        milestone: m.key,
        dueKey: task.dueDate,
        userIds: [taskOwner(task)],
        kind: m.kind,
        severity: m.severity,
        title: reminderTitle(m, subject, task.dueDate),
        link: taskLink(task.id),
        email: m.email,
      });
    if (task.dueDate >= ctx.today) continue;
    const escalateOn = addWorkingDays(
      addDays(task.dueDate, 1),
      ctx.escalationWorkingDays - 1,
      ctx.calendar,
    );
    if (!within(escalateOn, ctx.today)) continue;
    const late = countWorkingDays(
      addDays(task.dueDate, 1),
      ctx.today,
      ctx.calendar,
    );
    planned.push({
      subjectType: 'TASK',
      subjectId: task.id,
      milestone: 'ESC',
      dueKey: task.dueDate,
      userIds: await managers(task.customerId, task.contractServiceId),
      kind: NotificationKind.ESCALATION,
      severity: NotificationSeverity.DANGER,
      title: `Việc quá hạn ${late} ngày làm việc chưa xong: ${subject}, hạn ${fmtDate(task.dueDate)}`,
      link: taskLink(task.id),
      email: true,
    });
  }
  return planned;
}

/** Lịch báo cáo chưa nộp không có việc gắn → nhắc nhân viên phụ trách KH (việc gắn đã được nhắc). */
export async function planObligationReminders(
  db: Db,
  ctx: PlanContext,
): Promise<PlannedReminder[]> {
  const obligations = await db.customerObligation.findMany({
    where: {
      status: { in: [ObligationStatus.NOT_DUE, ObligationStatus.PREPARING] },
      dueDate: { gte: addDays(ctx.today, -60), lte: addDays(ctx.today, 91) },
      tasks: { none: { deletedAt: null } },
      customer: { deletedAt: null },
    },
    include: {
      customer: { select: { name: true, ownerId: true } },
      obligationType: { select: { name: true } },
    },
  });
  return obligations.flatMap((o): PlannedReminder[] => {
    const m = currentMilestone(o.dueDate, ctx.today, ctx.urgency.global);
    if (!m) return [];
    const subject = `${o.obligationType.name} kỳ ${o.period} — ${o.customer.name}`;
    return [
      {
        subjectType: 'OBLIGATION',
        subjectId: o.id,
        milestone: m.key,
        dueKey: o.dueDate,
        userIds: [o.customer.ownerId],
        kind: m.kind,
        severity: m.severity,
        title: reminderTitle(m, subject, o.dueDate),
        link: `/deadlines?id=${o.id}`,
        email: m.email,
      },
    ];
  });
}

/** I13: lượt soát xét quá 2 ngày làm việc → nhắc người soát xét; thêm 2 ngày → báo quản lý. */
export async function planReviewSla(
  db: Db,
  ctx: PlanContext,
): Promise<PlannedReminder[]> {
  const tasks = await db.task.findMany({
    where: { deletedAt: null, status: TaskStatus.IN_REVIEW },
    include: { customer: { select: { name: true } } },
  });
  if (!tasks.length) return [];
  const entered = new Map(
    (
      await db.taskStatusEvent.groupBy({
        by: ['taskId'],
        where: { taskId: { in: tasks.map((t) => t.id) } },
        _max: { occurredAt: true },
      })
    ).map((r) => [r.taskId, r._max.occurredAt!]),
  );
  const managers = managerResolver(db);
  const planned: PlannedReminder[] = [];
  for (const task of tasks) {
    const since = entered.get(task.id) ?? task.updatedAt;
    const waited = workingDaysWaited(since, ctx.now, ctx.calendar);
    if (waited <= REVIEW_SLA_DAYS) continue;
    const level = task.reviewLevel ?? 1;
    const base = {
      subjectType: 'TASK' as const,
      subjectId: task.id,
      dueKey: vietnamDate(since),
      link: taskLink(task.id),
      email: true,
    };
    const subject = `${task.title} — ${task.customer.name}`;
    planned.push({
      ...base,
      milestone: `SLA-L${level}`,
      userIds: [taskOwner(task)],
      kind: NotificationKind.REVIEW_SLA,
      severity: NotificationSeverity.WARNING,
      title: `Việc chờ bạn soát xét quá ${REVIEW_SLA_DAYS} ngày làm việc (${waited} ngày): ${subject}`,
    });
    if (waited > REVIEW_SLA_DAYS + REVIEW_ESCALATION_EXTRA_DAYS)
      planned.push({
        ...base,
        milestone: `SLA-ESC-L${level}`,
        userIds: await managers(task.customerId, task.contractServiceId),
        kind: NotificationKind.REVIEW_SLA_ESCALATION,
        severity: NotificationSeverity.DANGER,
        title: `Lượt soát xét cấp ${level} chờ ${waited} ngày làm việc: ${subject}`,
      });
  }
  return planned;
}

/**
 * Bản tin buổi sáng của một người (I13): việc hạn hôm nay, quá hạn, chờ tôi soát xét, báo cáo pháp lý
 * đến hạn trong 3 ngày. Không có mục nào → null (không gửi bản tin rỗng).
 */
export async function planDigest(
  db: Db,
  ctx: PlanContext,
  userId: string,
): Promise<PlannedReminder | null> {
  const open = {
    deletedAt: null,
    status: { notIn: [TaskStatus.COMPLETED, TaskStatus.ON_HOLD] },
  };
  const [dueToday, overdue, reviews, filings] = await Promise.all([
    db.task.count({
      where: { ...open, assigneeId: userId, dueDate: ctx.today },
    }),
    db.task.count({
      where: { ...open, assigneeId: userId, dueDate: { lt: ctx.today } },
    }),
    db.task.count({
      where: {
        deletedAt: null,
        status: TaskStatus.IN_REVIEW,
        OR: [
          { reviewLevel: 1, reviewerId: userId },
          { reviewLevel: 2, approverId: userId },
        ],
      },
    }),
    db.customerObligation.count({
      where: {
        status: { in: [ObligationStatus.NOT_DUE, ObligationStatus.PREPARING] },
        dueDate: { gte: ctx.today, lte: addDays(ctx.today, 3) },
        OR: [
          {
            customer: { ownerId: userId },
            tasks: { none: { deletedAt: null } },
          },
          { tasks: { some: { ...open, assigneeId: userId } } },
        ],
      },
    }),
  ]);
  if (dueToday + overdue + reviews + filings === 0) return null;
  const lines = [
    `Việc hạn hôm nay: ${dueToday}`,
    `Việc quá hạn: ${overdue}`,
    `Chờ bạn kiểm tra/phê duyệt: ${reviews}`,
    `Báo cáo pháp lý đến hạn trong 3 ngày: ${filings}`,
  ];
  return {
    subjectType: 'USER',
    subjectId: userId,
    milestone: 'DIGEST',
    dueKey: ctx.today,
    userIds: [userId],
    kind: NotificationKind.DIGEST,
    severity: overdue
      ? NotificationSeverity.WARNING
      : NotificationSeverity.INFO,
    title: `Bản tin công việc ngày ${fmtDate(ctx.today)}: ${dueToday} việc hôm nay, ${overdue} quá hạn, ${reviews} chờ soát xét, ${filings} báo cáo sắp hạn`,
    body: lines.join('\n'),
    link: '/tasks/my',
    email: true,
  };
}
