import { Injectable } from '@nestjs/common';
import {
  ContractStatus,
  DocumentRequestStatus,
  NotificationSeverity,
  ObligationStatus,
  Prisma,
  ServiceStatus,
  TaskStatus,
} from '@prisma/client';
import {
  contractScope,
  customerScope,
} from '../../core/access-control/data-scope';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  currentMonth,
  daysBetween,
  formatBusinessDate,
  NON_REVENUE_STATUSES,
  Period,
  resolvePeriod,
  vnDateOf,
} from '../reports/utils/period.util';
import {
  addDays,
  baseTaskWhere,
  OPEN_WHERE,
  overdueWhere,
  todayUtc,
} from '../tasks/task-filters';
import {
  DashboardQueryDto,
  ServiceListQueryDto,
} from './dto/dashboard-query.dto';

/** M2: yêu cầu hồ sơ đang chờ khách (đã yêu cầu / cần bổ sung). */
export const WAITING_REQUEST_STATUSES: DocumentRequestStatus[] = [
  DocumentRequestStatus.REQUESTED,
  DocumentRequestStatus.NEEDS_SUPPLEMENT,
];
const DEADLINE_DAYS = 14;
const LIST_SIZE = 8;

const TASK_SELECT = {
  id: true,
  title: true,
  dueDate: true,
  status: true,
  priority: true,
  isStatutory: true,
  customer: { select: { name: true } },
  assignee: { select: { fullName: true } },
} satisfies Prisma.TaskSelect;

/**
 * Tab Vận hành của tổng quan (đặc tả 10, M1–M3): 6 thẻ PL1 theo phạm vi người xem, việc cần ưu tiên,
 * tiến độ HĐ đang thực hiện, lịch hạn 14 ngày, thông báo quan trọng. Không có số tiền. Điều kiện đếm
 * dùng chung với trang danh sách (Công việc, Việc của tôi, Hồ sơ KH) để số trên thẻ = số dòng mở ra.
 * Thiếu quyền `tasks:view` / `deadlines:view` → phần tương ứng là null.
 */
@Injectable()
export class OperationsOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: DashboardQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentMonth());
    const canTasks = hasPermission(user, 'tasks', 'view');
    const canDeadlines = hasPermission(user, 'deadlines', 'view');
    const today = todayUtc();
    const tasks = canTasks ? await this.taskCards(user) : null;
    const [activeContracts, services, contractProgress, deadlines, notes] =
      await Promise.all([
        this.prisma.contract.count({ where: this.activeContracts(user) }),
        this.serviceCounts(user, period),
        this.contractProgress(user),
        this.deadlines(user, today, canTasks, canDeadlines),
        this.notifications(user),
      ]);
    return {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(period.to),
      cards: {
        activeContracts,
        openTasks: tasks?.open ?? null,
        overdueTasks: tasks?.overdue ?? null,
        waitingCustomer: tasks?.waiting ?? null,
        awaitingMyReview: tasks?.review ?? null,
        services,
      },
      priorityTasks: canTasks ? await this.priorityTasks(user, today) : null,
      contractProgress,
      deadlines,
      notifications: notes,
    };
  }

  /** Danh sách dịch vụ của thẻ "Dịch vụ hoàn thành" (M3): hoàn thành trong kỳ hoặc đang chạy. */
  async services(query: ServiceListQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentMonth());
    const { done, open } = await this.serviceSets(user, period);
    const ids = query.state === 'open' ? open : [...done.keys()];
    const rows = await this.prisma.contractService.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        status: true,
        serviceType: { select: { name: true } },
        contract: {
          select: {
            id: true,
            code: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: [{ contract: { code: 'asc' } }],
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.serviceType.name,
      status: s.status,
      contract: { id: s.contract.id, code: s.contract.code },
      customerName: s.contract.customer.name,
      completedOn: done.has(s.id) ? formatBusinessDate(done.get(s.id)!) : null,
    }));
  }

  private activeContracts(user: AuthUser): Prisma.ContractWhereInput {
    return {
      AND: [
        contractScope(user),
        { deletedAt: null, status: ContractStatus.IN_PROGRESS },
      ],
    };
  }

  private async taskCards(user: AuthUser) {
    const base = baseTaskWhere(user);
    const count = (extra: Prisma.TaskWhereInput) =>
      this.prisma.task.count({ where: { AND: [...base, extra] } });
    const [open, overdue, review, waiting] = await Promise.all([
      count(OPEN_WHERE),
      count(overdueWhere()),
      // Như "Chờ tôi kiểm tra / phê duyệt" của Việc của tôi (05-E).
      count({
        status: TaskStatus.IN_REVIEW,
        OR: [
          { reviewLevel: 1, reviewerId: user.id },
          { reviewLevel: 2, approverId: user.id },
        ],
      }),
      // Như trang Hồ sơ khách hàng (05-E): KH trong phạm vi, chưa xoá.
      this.visibleCustomerIds(user).then((ids) =>
        this.prisma.customerDocumentRequest.count({
          where: {
            status: { in: WAITING_REQUEST_STATUSES },
            customerId: { in: ids },
          },
        }),
      ),
    ]);
    return { open, overdue, review, waiting };
  }

  private async visibleCustomerIds(user: AuthUser): Promise<string[]> {
    const rows = await this.prisma.customer.findMany({
      where: { AND: [{ deletedAt: null }, customerScope(user)] },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * Dịch vụ hoàn thành trong kỳ (ngày hoàn thành = ngày việc cuối cùng hoàn thành, giờ VN) và dịch vụ
   * đang chạy (chưa hoàn thành, HĐ chưa bắt đầu / đang thực hiện) trong phạm vi HĐ.
   */
  private async serviceSets(user: AuthUser, period: Period) {
    const contract = {
      AND: [
        contractScope(user),
        { deletedAt: null, status: { notIn: NON_REVENUE_STATUSES } },
      ],
    };
    const [completed, open] = await Promise.all([
      this.prisma.contractService.findMany({
        where: { contract, status: ServiceStatus.COMPLETED },
        select: { id: true },
      }),
      this.prisma.contractService.findMany({
        where: {
          contract: {
            AND: [
              contract,
              {
                status: {
                  in: [ContractStatus.NOT_STARTED, ContractStatus.IN_PROGRESS],
                },
              },
            ],
          },
          status: { not: ServiceStatus.COMPLETED },
        },
        select: { id: true },
      }),
    ]);
    const finished = await this.prisma.task.groupBy({
      by: ['contractServiceId'],
      where: {
        contractServiceId: { in: completed.map((s) => s.id) },
        deletedAt: null,
      },
      _max: { completedAt: true },
    });
    const done = new Map<string, Date>();
    for (const f of finished) {
      const at = f._max.completedAt;
      if (!f.contractServiceId || !at) continue;
      const day = vnDateOf(at);
      if (day >= period.from && day <= period.to)
        done.set(f.contractServiceId, day);
    }
    return { done, open: open.map((s) => s.id) };
  }

  private async serviceCounts(user: AuthUser, period: Period) {
    const { done, open } = await this.serviceSets(user, period);
    return { done: done.size, total: done.size + open.length };
  }

  /** Việc cần ưu tiên: chưa hoàn thành, hạn sớm nhất trước (quá hạn lên đầu), mức ưu tiên cao trước. */
  private async priorityTasks(user: AuthUser, today: Date) {
    const rows = await this.prisma.task.findMany({
      where: {
        AND: [
          ...baseTaskWhere(user),
          OPEN_WHERE,
          { status: { not: TaskStatus.ON_HOLD } },
        ],
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: LIST_SIZE,
      select: TASK_SELECT,
    });
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      customerName: t.customer.name,
      assigneeName: t.assignee?.fullName ?? null,
      status: t.status,
      priority: t.priority,
      statutory: t.isStatutory,
      dueDate: formatBusinessDate(t.dueDate),
      daysLeft: daysBetween(today, t.dueDate),
    }));
  }

  /** Tiến độ HĐ đang thực hiện: số việc hoàn thành / tổng việc (không tính việc đã xoá). */
  private async contractProgress(user: AuthUser) {
    const contracts = await this.prisma.contract.findMany({
      where: this.activeContracts(user),
      orderBy: [{ endDate: { sort: 'asc', nulls: 'last' } }, { code: 'asc' }],
      take: LIST_SIZE - 2,
      select: {
        id: true,
        code: true,
        endDate: true,
        customer: { select: { name: true } },
        services: { select: { id: true } },
      },
    });
    const serviceOf = new Map(
      contracts.flatMap((c) => c.services.map((s) => [s.id, c.id] as const)),
    );
    const counts = await this.prisma.task.groupBy({
      by: ['contractServiceId', 'status'],
      where: {
        contractServiceId: { in: [...serviceOf.keys()] },
        deletedAt: null,
      },
      _count: { _all: true },
    });
    const progress = new Map<string, { done: number; all: number }>();
    for (const c of counts) {
      const id = serviceOf.get(c.contractServiceId!)!;
      const p = progress.get(id) ?? { done: 0, all: 0 };
      p.all += c._count._all;
      if (c.status === TaskStatus.COMPLETED) p.done += c._count._all;
      progress.set(id, p);
    }
    return contracts.map((c) => {
      const p = progress.get(c.id) ?? { done: 0, all: 0 };
      return {
        id: c.id,
        code: c.code,
        customerName: c.customer.name,
        endDate: c.endDate ? formatBusinessDate(c.endDate) : null,
        tasksDone: p.done,
        tasksAll: p.all,
        percent: p.all ? Math.round((p.done / p.all) * 100) : null,
      };
    });
  }

  /** Lịch hạn 14 ngày: việc chưa xong + lịch báo cáo (06) chưa nộp, không có việc gắn (tránh trùng). */
  private async deadlines(
    user: AuthUser,
    today: Date,
    canTasks: boolean,
    canDeadlines: boolean,
  ) {
    const window = { gte: today, lte: addDays(today, DEADLINE_DAYS) };
    const [tasks, obligations] = await Promise.all([
      canTasks
        ? this.prisma.task.findMany({
            where: {
              AND: [...baseTaskWhere(user), OPEN_WHERE, { dueDate: window }],
            },
            orderBy: { dueDate: 'asc' },
            take: LIST_SIZE + 2,
            select: TASK_SELECT,
          })
        : [],
      canDeadlines
        ? this.prisma.customerObligation.findMany({
            where: {
              status: {
                in: [ObligationStatus.NOT_DUE, ObligationStatus.PREPARING],
              },
              dueDate: window,
              tasks: { none: { deletedAt: null } },
              customer: { AND: [{ deletedAt: null }, customerScope(user)] },
            },
            orderBy: { dueDate: 'asc' },
            take: LIST_SIZE + 2,
            select: {
              id: true,
              period: true,
              dueDate: true,
              customer: { select: { name: true } },
              obligationType: { select: { name: true } },
            },
          })
        : [],
    ]);
    const items = [
      ...tasks.map((t) => ({
        kind: 'TASK' as const,
        id: t.id,
        title: t.title,
        customerName: t.customer.name,
        statutory: t.isStatutory,
        due: t.dueDate,
      })),
      ...obligations.map((o) => ({
        kind: 'OBLIGATION' as const,
        id: o.id,
        title: `${o.obligationType.name} kỳ ${o.period}`,
        customerName: o.customer.name,
        statutory: true,
        due: o.dueDate,
      })),
    ];
    return items
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, LIST_SIZE + 2)
      .map(({ due, ...item }) => ({
        ...item,
        dueDate: formatBusinessDate(due),
        daysLeft: daysBetween(today, due),
      }));
  }

  /** Thông báo quan trọng: chưa đọc, mức Cảnh báo / Khẩn (06). */
  private async notifications(user: AuthUser) {
    const where = {
      userId: user.id,
      readAt: null,
      severity: {
        in: [NotificationSeverity.WARNING, NotificationSeverity.DANGER],
      },
    };
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          link: true,
          severity: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, unread };
  }
}
