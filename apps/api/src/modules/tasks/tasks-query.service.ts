import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { paginated, Paginated, toSkipTake } from '../../common/types/paginated';
import { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CalendarQueryDto,
  TaskQueryDto,
  TaskSummaryQueryDto,
} from './dto/task.dto';
import {
  baseTaskWhere,
  buildTaskWhere,
  COMPLETED_THIS_MONTH,
  EVIDENCE_DOC_WHERE,
  MISSING_EVIDENCE_WHERE,
  OPEN_WHERE,
  overdueWhere,
  TASK_LIST_INCLUDE,
  TaskRow,
  todayUtc,
  toTaskRow,
} from './task-filters';
import { confirmedWaitDays } from './client-wait.rules';
import { loadUnmetPrerequisites } from './task-dependencies';
import { statusGroup } from './task-status.rules';
import { loadUrgencyConfig } from '../deadlines/urgency';

/** Dòng ghi tự động trùng với dòng nghiệp vụ (đã ghi trong nhật ký/lịch sử trạng thái). */
const HISTORY_SKIP_PATHS = [
  '/evidence',
  '/start',
  '/submit',
  '/complete',
  '/review',
  '/deliver',
  '/wait-client',
  '/resume',
  '/hold',
  '/unhold',
  '/reopen',
  '/due-changes',
  '/decide',
  '/confirm',
];

/** Cột thống kê theo khách hàng theo nhóm trạng thái (giữ 3 cột cũ đến 05-E). */
const CUSTOMER_COLUMN = {
  TODO: 'todo',
  IN_PROGRESS: 'inProgress',
  DONE: 'done',
} as const;

const PERSON = { select: { id: true, fullName: true } } as const;

export interface CustomerTaskStats {
  customerId: string;
  customerName: string;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  missingEvidence: number;
}

/** Đọc, lọc, thống kê công việc (phần ghi nằm ở TasksService). */
@Injectable()
export class TasksQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    user: AuthUser,
    query: TaskQueryDto,
  ): Promise<Paginated<TaskRow>> {
    const where = buildTaskWhere(user, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: TASK_LIST_INCLUDE,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.task.count({ where }),
    ]);
    const now = new Date();
    const [unmet, urgency] = await Promise.all([
      this.unmet(items),
      loadUrgencyConfig(this.prisma),
    ]);
    return paginated(
      items.map((t) => toTaskRow(t, now, unmet.get(t.id), urgency)),
      total,
      query,
    );
  }

  async summary(user: AuthUser, query: TaskSummaryQueryDto) {
    const base = baseTaskWhere(user, query.mine);
    const count = (extra: Prisma.TaskWhereInput) =>
      this.prisma.task.count({ where: { AND: [...base, extra] } });
    const [
      dueToday,
      remaining,
      overdue,
      doneThisMonth,
      missingEvidence,
      awaitingMyReview,
    ] = await Promise.all([
      count({ ...OPEN_WHERE, dueDate: todayUtc() }),
      count(OPEN_WHERE),
      count(overdueWhere()),
      count(COMPLETED_THIS_MONTH()),
      count(MISSING_EVIDENCE_WHERE),
      // 05-E: việc đang chờ chính tôi kiểm tra/phê duyệt (không phụ thuộc "việc của tôi").
      this.prisma.task.count({
        where: {
          AND: [
            ...baseTaskWhere(user),
            { status: TaskStatus.IN_REVIEW },
            {
              OR: [
                { reviewLevel: 1, reviewerId: user.id },
                { reviewLevel: 2, approverId: user.id },
              ],
            },
          ],
        },
      }),
    ]);
    const groups = await this.prisma.task.groupBy({
      by: ['status'],
      where: { AND: base },
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      Object.values(TaskStatus).map((s) => [s, 0]),
    ) as Record<TaskStatus, number>;
    for (const g of groups) byStatus[g.status] = g._count._all;
    return {
      dueToday,
      remaining,
      overdue,
      doneThisMonth,
      missingEvidence,
      awaitingMyReview,
      waitingClient: byStatus.WAITING_CLIENT,
      inReview: byStatus.IN_REVIEW,
      byStatus,
    };
  }

  /** Thống kê theo khách hàng trong phạm vi (cho quản lý). */
  async byCustomer(user: AuthUser): Promise<CustomerTaskStats[]> {
    const base = baseTaskWhere(user);
    const [byStatus, overdue, missing] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['customerId', 'status'],
        where: { AND: base },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['customerId'],
        where: { AND: [...base, overdueWhere()] },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['customerId'],
        where: { AND: [...base, MISSING_EVIDENCE_WHERE] },
        _count: { _all: true },
      }),
    ]);
    const ids = [...new Set(byStatus.map((g) => g.customerId))];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const stats = new Map<string, CustomerTaskStats>(
      customers.map((c) => [
        c.id,
        {
          customerId: c.id,
          customerName: c.name,
          todo: 0,
          inProgress: 0,
          done: 0,
          overdue: 0,
          missingEvidence: 0,
        },
      ]),
    );
    for (const g of byStatus) {
      const row = stats.get(g.customerId);
      if (row) row[CUSTOMER_COLUMN[statusGroup(g.status)]] += g._count._all;
    }
    for (const g of overdue) {
      const row = stats.get(g.customerId);
      if (row) row.overdue = g._count._all;
    }
    for (const g of missing) {
      const row = stats.get(g.customerId);
      if (row) row.missingEvidence = g._count._all;
    }
    return [...stats.values()].sort((a, b) =>
      a.customerName.localeCompare(b.customerName, 'vi'),
    );
  }

  /** Khối lượng việc theo nhân viên trong phạm vi. */
  async workload(user: AuthUser) {
    const base = [...baseTaskWhere(user), { assigneeId: { not: null } }];
    const group = (extra: Prisma.TaskWhereInput) =>
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: { AND: [...base, extra] },
        _count: { _all: true },
      });
    const [open, overdue, done] = await Promise.all([
      group(OPEN_WHERE),
      group(overdueWhere()),
      group(COMPLETED_THIS_MONTH()),
    ]);
    const toMap = (
      rows: { assigneeId: string | null; _count: { _all: number } }[],
    ) => new Map(rows.map((r) => [r.assigneeId ?? '', r._count._all]));
    const [openMap, overdueMap, doneMap] = [
      toMap(open),
      toMap(overdue),
      toMap(done),
    ];
    const ids = [...new Set([...openMap.keys(), ...doneMap.keys()])];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
    return users.map((u) => ({
      userId: u.id,
      fullName: u.fullName,
      role: u.role,
      open: openMap.get(u.id) ?? 0,
      overdue: overdueMap.get(u.id) ?? 0,
      doneThisMonth: doneMap.get(u.id) ?? 0,
    }));
  }

  async findOne(user: AuthUser, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { AND: [...baseTaskWhere(user), { id }] },
      include: {
        ...TASK_LIST_INCLUDE,
        createdBy: PERSON,
        approvedBy: PERSON,
        statusEvents: {
          orderBy: { occurredAt: 'desc' },
          take: 200,
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            actorId: true,
            note: true,
            occurredAt: true,
          },
        },
        clientWaits: { orderBy: { startedAt: 'desc' } },
        comments: { orderBy: { createdAt: 'desc' }, take: 200 },
        dueChanges: { orderBy: { requestedAt: 'desc' } },
        reviews: {
          orderBy: { decidedAt: 'desc' },
          select: {
            id: true,
            level: true,
            reviewerId: true,
            decision: true,
            note: true,
            enteredAt: true,
            decidedAt: true,
          },
        },
        documents: {
          where: EVIDENCE_DOC_WHERE,
          select: {
            id: true,
            fileName: true,
            size: true,
            mimeType: true,
            note: true,
            createdAt: true,
            uploadedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    const {
      documents,
      createdBy,
      approvedBy,
      statusEvents,
      reviews,
      clientWaits,
      dueChanges,
      comments,
      ...rest
    } = task;
    const people = await this.people([
      rest.reviewerId,
      rest.approverId,
      ...statusEvents.map((e) => e.actorId),
      ...reviews.map((r) => r.reviewerId),
      ...clientWaits.map((w) => w.confirmedById),
      ...dueChanges.flatMap((c) => [c.requestedById, c.decidedById]),
      ...comments.map((c) => c.authorId),
    ]);
    const person = (id: string | null) =>
      id ? (people.get(id) ?? null) : null;
    const [unmet, urgency] = await Promise.all([
      this.unmet([rest]),
      loadUrgencyConfig(this.prisma),
    ]);
    return {
      ...toTaskRow(rest, undefined, unmet.get(rest.id), urgency),
      reviewer: person(rest.reviewerId),
      approver: person(rest.approverId),
      createdBy,
      approvedBy,
      documents,
      statusEvents: statusEvents.map(({ actorId, ...e }) => ({
        ...e,
        actor: person(actorId),
      })),
      reviews: reviews.map(({ reviewerId, ...r }) => ({
        ...r,
        reviewer: person(reviewerId),
      })),
      // 05-D: khoảng chờ khách (G5) và gia hạn (H7).
      clientWaits: clientWaits.map(({ confirmedById, ...w }) => ({
        ...w,
        confirmedBy: person(confirmedById),
      })),
      confirmedWaitDays: confirmedWaitDays(clientWaits),
      dueChanges: dueChanges.map(({ requestedById, decidedById, ...c }) => ({
        ...c,
        requestedBy: person(requestedById),
        decidedBy: person(decidedById),
      })),
      comments: comments.map(({ authorId, ...c }) => ({
        ...c,
        author: person(authorId),
      })),
      history: await this.history(id),
    };
  }

  /** H6 cho các việc Chưa bắt đầu đang hiển thị. */
  private unmet(
    tasks: {
      id: string;
      status: TaskStatus;
      planStepId: string | null;
      period: string | null;
    }[],
  ) {
    return loadUnmetPrerequisites(
      this.prisma,
      tasks.filter((t) => t.status === TaskStatus.NOT_STARTED),
    );
  }

  /** Người dùng theo id (người soát xét lưu bằng id, không có quan hệ). */
  private async people(ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    const users = wanted.length
      ? await this.prisma.user.findMany({
          where: { id: { in: wanted } },
          select: { id: true, fullName: true },
        })
      : [];
    return new Map(users.map((u) => [u.id, u]));
  }

  /** Lịch sử từ nhật ký hoạt động; bỏ dòng ghi tự động trùng với dòng nghiệp vụ. */
  private async history(id: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { entity: 'tasks', entityId: id },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return logs
      .filter((log) => {
        const path = (log.detail as { path?: unknown } | null)?.path;
        return !(
          typeof path === 'string' &&
          HISTORY_SKIP_PATHS.some((p) => path.endsWith(p))
        );
      })
      .map((log) => ({
        id: log.id,
        action: log.action,
        detail: log.detail,
        createdAt: log.createdAt,
        user: log.user,
      }));
  }

  async calendar(user: AuthUser, query: CalendarQueryDto) {
    const tasks = await this.prisma.task.findMany({
      where: {
        AND: [
          ...baseTaskWhere(user, query.mine),
          { dueDate: { gte: new Date(query.from), lte: new Date(query.to) } },
        ],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        period: true,
        customer: { select: { id: true, name: true } },
        assignee: { select: { id: true, fullName: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
      take: 2000,
    });
    const today = todayUtc();
    return tasks.map((t) => ({
      ...t,
      isOverdue: t.status !== TaskStatus.COMPLETED && t.dueDate < today,
    }));
  }
}
