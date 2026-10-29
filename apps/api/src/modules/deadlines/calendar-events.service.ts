import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  CalendarYearStatus,
  ObligationStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import { customerScope } from '../../core/access-control/data-scope';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { baseTaskWhere } from '../tasks/task-filters';
import {
  daysBetween,
  formatBusinessDate,
  todayVn,
  toBusinessDate,
} from '../reports/utils/period.util';
import {
  CalendarEventsQueryDto,
  CalendarStatus,
} from './dto/calendar-events.dto';
import {
  loadUrgencyConfig,
  thresholdsFor,
  urgencyOf,
  type UrgencyConfig,
} from './urgency';

/** Khoảng tối đa một lần tải: đủ lưới tháng 6 tuần và danh sách theo tháng. */
const MAX_RANGE_DAYS = 100;
const MAX_ROWS = 1500;
const OPEN_OBLIGATION: ObligationStatus[] = [
  ObligationStatus.NOT_DUE,
  ObligationStatus.PREPARING,
];

const TASK_SELECT = {
  id: true,
  code: true,
  title: true,
  dueDate: true,
  status: true,
  period: true,
  isStatutory: true,
  obligationId: true,
  customer: { select: { id: true, name: true } },
  assignee: { select: { id: true, fullName: true } },
  contractService: { select: { serviceType: { select: { id: true } } } },
} satisfies Prisma.TaskSelect;

const OBLIGATION_SELECT = {
  id: true,
  period: true,
  dueDate: true,
  status: true,
  filedLate: true,
  customer: {
    select: {
      id: true,
      name: true,
      owner: { select: { id: true, fullName: true } },
    },
  },
  obligationType: { select: { id: true, code: true, name: true } },
  tasks: {
    where: { deletedAt: null },
    select: { id: true, code: true, title: true, status: true },
  },
} satisfies Prisma.CustomerObligationSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;
type ObligationRow = Prisma.CustomerObligationGetPayload<{
  select: typeof OBLIGATION_SELECT;
}>;

/**
 * Lịch & Deadline (đặc tả 06, I14): gộp hạn pháp lý (lịch báo cáo) và hạn hiện hành của việc nội
 * bộ trong phạm vi được xem. Người chỉ có `tasks:view` chỉ thấy việc, chỉ có `deadlines:view` chỉ
 * thấy nghĩa vụ; nghĩa vụ "Không áp dụng" không lên lịch.
 */
@Injectable()
export class CalendarEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, query: CalendarEventsQueryDto) {
    const canTasks = hasPermission(user, 'tasks', 'view');
    const canObligations = hasPermission(user, 'deadlines', 'view');
    if (!canTasks && !canObligations)
      throw new ForbiddenException('Bạn không có quyền xem lịch');
    const from = toBusinessDate(query.from);
    const to = toBusinessDate(query.to);
    const span = daysBetween(from, to);
    if (span < 0 || span > MAX_RANGE_DAYS)
      throw new BadRequestException(
        `Khoảng ngày phải từ 0 đến ${MAX_RANGE_DAYS} ngày`,
      );
    const today = todayVn();
    const [tasks, obligations, urgency, calendar] = await Promise.all([
      canTasks && query.kind !== 'STATUTORY'
        ? this.tasks(user, query, from, to, today)
        : [],
      canObligations && query.kind !== 'INTERNAL'
        ? this.obligations(user, query, from, to, today)
        : [],
      loadUrgencyConfig(this.prisma),
      this.calendarDays(from, to),
    ]);
    const events = [
      ...obligations.map((o) => obligationEvent(o, today, urgency)),
      ...tasks.map((t) => taskEvent(t, today, urgency)),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return {
      events,
      truncated: tasks.length >= MAX_ROWS || obligations.length >= MAX_ROWS,
      ...calendar,
    };
  }

  private tasks(
    user: AuthUser,
    query: CalendarEventsQueryDto,
    from: Date,
    to: Date,
    today: Date,
  ): Promise<TaskRow[]> {
    const and: Prisma.TaskWhereInput[] = [
      ...baseTaskWhere(user),
      { dueDate: { gte: from, lte: to } },
      taskStatusWhere(query.status, today),
    ];
    if (query.customerId) and.push({ customerId: query.customerId });
    if (query.userId) and.push({ assigneeId: query.userId });
    if (query.obligationTypeId)
      and.push({ obligation: { obligationTypeId: query.obligationTypeId } });
    return this.prisma.task.findMany({
      where: { AND: and },
      select: TASK_SELECT,
      orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
      take: MAX_ROWS,
    });
  }

  private obligations(
    user: AuthUser,
    query: CalendarEventsQueryDto,
    from: Date,
    to: Date,
    today: Date,
  ): Promise<ObligationRow[]> {
    const and: Prisma.CustomerObligationWhereInput[] = [
      { customer: { ...customerScope(user), deletedAt: null } },
      { dueDate: { gte: from, lte: to } },
      obligationStatusWhere(query.status, today),
    ];
    if (query.customerId) and.push({ customerId: query.customerId });
    if (query.obligationTypeId)
      and.push({ obligationTypeId: query.obligationTypeId });
    // Nghĩa vụ của một nhân viên: KH do người đó phụ trách hoặc có việc gắn giao cho người đó.
    if (query.userId)
      and.push({
        OR: [
          { customer: { ownerId: query.userId } },
          {
            tasks: { some: { deletedAt: null, assigneeId: query.userId } },
          },
        ],
      });
    return this.prisma.customerObligation.findMany({
      where: { AND: and },
      select: OBLIGATION_SELECT,
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
    });
  }

  /** Ngày nghỉ/làm bù của năm đã xác nhận trong khoảng; năm chưa xác nhận để hiện cảnh báo (I2). */
  private async calendarDays(from: Date, to: Date) {
    const years: number[] = [];
    for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++)
      years.push(y);
    const confirmed = await this.prisma.businessCalendarYear.findMany({
      where: { year: { in: years }, status: CalendarYearStatus.CONFIRMED },
      select: { year: true },
    });
    const confirmedYears = confirmed.map((c) => c.year);
    const days = confirmedYears.length
      ? await this.prisma.businessCalendarDay.findMany({
          where: {
            year: { in: confirmedYears },
            date: { gte: from, lte: to },
          },
          select: { date: true, kind: true, name: true },
          orderBy: { date: 'asc' },
        })
      : [];
    return {
      days: days.map((d) => ({
        date: formatBusinessDate(d.date),
        kind: d.kind,
        name: d.name,
      })),
      unconfirmedYears: years.filter((y) => !confirmedYears.includes(y)),
    };
  }
}

function taskStatusWhere(
  status: CalendarStatus | undefined,
  today: Date,
): Prisma.TaskWhereInput {
  switch (status) {
    case 'OPEN':
      return { status: { not: TaskStatus.COMPLETED } };
    case 'OVERDUE':
      return { status: { not: TaskStatus.COMPLETED }, dueDate: { lt: today } };
    case 'DONE':
      return { status: TaskStatus.COMPLETED };
    default:
      return {};
  }
}

function obligationStatusWhere(
  status: CalendarStatus | undefined,
  today: Date,
): Prisma.CustomerObligationWhereInput {
  switch (status) {
    case 'OPEN':
      return { status: { in: OPEN_OBLIGATION } };
    case 'OVERDUE':
      return { status: { in: OPEN_OBLIGATION }, dueDate: { lt: today } };
    case 'DONE':
      return { status: ObligationStatus.FILED };
    default:
      return { status: { not: ObligationStatus.NOT_APPLICABLE } };
  }
}

function taskEvent(t: TaskRow, today: Date, urgency: UrgencyConfig) {
  const done = t.status === TaskStatus.COMPLETED;
  return {
    kind: 'TASK' as const,
    id: t.id,
    code: t.code,
    date: formatBusinessDate(t.dueDate),
    title: t.title,
    status: t.status,
    done,
    overdue: !done && t.dueDate < today,
    urgency: done
      ? null
      : urgencyOf(
          t.dueDate,
          today,
          thresholdsFor(urgency, t.contractService?.serviceType.id),
        ),
    period: t.period,
    customer: t.customer,
    person: t.assignee,
    isStatutory: t.isStatutory,
    obligationId: t.obligationId,
  };
}

/** Trạng thái hiển thị như lịch báo cáo: chưa nộp mà quá hạn (giờ VN) → OVERDUE "Trễ hạn" (I7). */
function obligationEvent(
  o: ObligationRow,
  today: Date,
  urgency: UrgencyConfig,
) {
  const done = o.status === ObligationStatus.FILED;
  const overdue = !done && o.dueDate < today;
  return {
    kind: 'OBLIGATION' as const,
    id: o.id,
    code: o.obligationType.code,
    date: formatBusinessDate(o.dueDate),
    title: o.obligationType.name,
    status: overdue ? 'OVERDUE' : o.status,
    done,
    overdue,
    urgency: done ? null : urgencyOf(o.dueDate, today, urgency.global),
    period: o.period,
    customer: { id: o.customer.id, name: o.customer.name },
    person: o.customer.owner,
    obligationType: o.obligationType,
    filedLate: o.filedLate,
    tasks: o.tasks,
  };
}
