import { Injectable } from '@nestjs/common';
import { DueChangeStatus, Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  assistantOutcome,
  isLate,
  onTimeRate,
  ratePercent,
  vnDayOf,
} from './utils/capability.rules';
import { formatBusinessDate, Period } from './utils/period.util';

export type CapabilityDomain = 'ACCOUNTING' | 'AUDIT' | 'ALL';

/** Lọc mảng: kiểm toán = dịch vụ có cờ phát hành BCKT (04-F); còn lại (kể cả việc không gắn dịch vụ) là kế toán. */
export function domainWhere(domain: CapabilityDomain): Prisma.TaskWhereInput {
  if (domain === 'AUDIT')
    return { contractService: { serviceType: { issuesAuditReport: true } } };
  if (domain === 'ACCOUNTING')
    return {
      OR: [
        { contractServiceId: null },
        { contractService: { serviceType: { issuesAuditReport: false } } },
      ],
    };
  return {};
}

const CONFIRMED_WAITS = {
  where: { confirmedAt: { not: null } },
  select: { startedAt: true, endedAt: true },
} as const;
/** Gia hạn đã duyệt; đổi hạn theo lịch (I8) không phải gia hạn. */
const EXTENSIONS = {
  where: { status: DueChangeStatus.APPROVED, calendarAdjusted: false },
  select: { id: true },
} as const;

const TASK_SELECT = {
  id: true,
  code: true,
  title: true,
  assigneeId: true,
  status: true,
  dueDate: true,
  originalDueDate: true,
  isStatutory: true,
  reviewLevels: true,
  firstSubmittedAt: true,
  acceptedAt: true,
  completedAt: true,
  legacy: true,
  returnCount: true,
  customer: { select: { id: true, name: true } },
  clientWaits: CONFIRMED_WAITS,
  dueChanges: EXTENSIONS,
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

/**
 * Chỉ số Trợ lý (khung G, G4–G6) của cả kế toán và kiểm toán: việc có hạn hiện hành trong kỳ, đánh giá
 * theo lần nộp đầu, cộng ngày chờ khách đã xác nhận với hạn nội bộ, trễ hạn pháp lý riêng, hạn gốc, gia
 * hạn, bị trả lại, khối lượng. Không có số tiền.
 */
@Injectable()
export class CapabilityTasksQuery {
  constructor(private readonly prisma: PrismaService) {}

  async assistants(
    userIds: string[],
    period: Period,
    domain: CapabilityDomain,
    today: Date,
  ) {
    const tasks = await this.tasks(userIds, period, domain);
    const [accepted, open] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: {
          AND: [
            { deletedAt: null, assigneeId: { in: userIds } },
            { acceptedAt: { gte: this.start(period), lt: this.end(period) } },
            domainWhere(domain),
          ],
        },
        _count: { _all: true },
      }),
      this.prisma.task.findMany({
        where: {
          AND: [
            { deletedAt: null, assigneeId: { in: userIds } },
            { status: { not: TaskStatus.COMPLETED } },
            domainWhere(domain),
          ],
        },
        select: { assigneeId: true, customerId: true },
        distinct: ['assigneeId', 'customerId'],
      }),
    ]);
    const byUser = new Map<string, ReturnType<typeof this.evaluate>[]>();
    for (const t of tasks) {
      const list = byUser.get(t.assigneeId!) ?? [];
      list.push(this.evaluate(t, today));
      byUser.set(t.assigneeId!, list);
    }
    return new Map(
      userIds.map((id) => {
        const rows = (byUser.get(id) ?? []).filter((r) => r.counted);
        const submitted = rows.filter((r) => r.milestone);
        return [
          id,
          {
            total: rows.length,
            onTime: rows.filter((r) => r.current.result === 'ON_TIME').length,
            late: rows.filter((r) => r.current.result === 'LATE').length,
            overdue: rows.filter((r) => r.current.result === 'OVERDUE').length,
            rate: onTimeRate(rows.map((r) => r.current)),
            rateOriginal: onTimeRate(rows.map((r) => r.original)),
            statutoryLate: rows.filter((r) => r.statutoryLate).length,
            clientDelay: rows.filter((r) => r.clientDelay).length,
            extensions: rows.reduce((n, r) => n + r.extensions, 0),
            submitted: submitted.length,
            returned: submitted.filter((r) => r.returned).length,
            returnRate: ratePercent(
              submitted.filter((r) => r.returned).length,
              submitted.length,
            ),
            accepted:
              accepted.find((a) => a.assigneeId === id)?._count._all ?? 0,
            openCustomers: open.filter((o) => o.assigneeId === id).length,
          },
        ];
      }),
    );
  }

  /** Danh sách việc được tính cho một người (ô bấm ra danh sách — tái lập con số). */
  async items(
    userId: string,
    period: Period,
    domain: CapabilityDomain,
    today: Date,
  ) {
    const tasks = await this.tasks([userId], period, domain);
    return tasks
      .map((t) => ({ t, r: this.evaluate(t, today) }))
      .sort((a, b) => a.t.dueDate.getTime() - b.t.dueDate.getTime())
      .map(({ t, r }) => ({
        id: t.id,
        code: t.code,
        title: t.title,
        customer: t.customer,
        status: t.status,
        dueDate: formatBusinessDate(t.dueDate),
        originalDueDate: formatBusinessDate(t.originalDueDate),
        milestone: r.milestone
          ? formatBusinessDate(vnDayOf(r.milestone))
          : null,
        counted: r.counted,
        result: r.current.result,
        days: r.current.days,
        originalResult: r.original.result,
        waitDays: r.waitDays,
        clientDelay: r.clientDelay,
        statutory: t.isStatutory,
        statutoryLate: r.statutoryLate,
        extensions: r.extensions,
        returnCount: t.returnCount,
      }));
  }

  private evaluate(t: TaskRow, today: Date) {
    const r = assistantOutcome({ ...t, waits: t.clientWaits }, today);
    return {
      ...r,
      extensions: t.dueChanges.length,
      returned: t.returnCount > 0,
      late: isLate(r.current),
    };
  }

  private tasks(userIds: string[], period: Period, domain: CapabilityDomain) {
    return this.prisma.task.findMany({
      where: {
        AND: [
          {
            deletedAt: null,
            assigneeId: { in: userIds },
            dueDate: { gte: period.from, lte: period.to },
          },
          domainWhere(domain),
        ],
      },
      select: TASK_SELECT,
    });
  }

  private start = (p: Period) => new Date(p.from.getTime() - 7 * 3_600_000);
  private end = (p: Period) =>
    new Date(p.to.getTime() + 86_400_000 - 7 * 3_600_000);
}
