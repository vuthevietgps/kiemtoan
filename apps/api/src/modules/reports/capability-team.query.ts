import { Injectable } from '@nestjs/common';
import {
  ContractStatus,
  DueChangeStatus,
  Prisma,
  ServiceTeamRole,
  TaskStatus,
} from '@prisma/client';
import type { WorkingCalendar } from '../../common/working-calendar';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  REVIEW_SLA_WORKING_DAYS,
  workingDaysWaited,
} from '../tasks/review-sla';
import {
  holderAt,
  momentOf,
  onTimeRate,
  periodOutcome,
  ratePercent,
} from './utils/capability.rules';
import { formatBusinessDate, Period } from './utils/period.util';

type TeamRole = 'LEAD' | 'MANAGER';

const PERIOD_TASKS = {
  where: { deletedAt: null },
  select: {
    period: true,
    dueDate: true,
    originalDueDate: true,
    isStatutory: true,
    status: true,
    acceptedAt: true,
    completedAt: true,
    clientWaits: {
      where: { confirmedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
    },
    dueChanges: {
      where: { status: DueChangeStatus.APPROVED, calendarAdjusted: false },
      select: { id: true },
    },
  },
} satisfies Prisma.TaskFindManyArgs;

/**
 * Chỉ số Trưởng nhóm / Manager mảng kế toán (khung G): **kỳ dịch vụ** (dòng dịch vụ × kỳ) của các dòng
 * có nhóm thực hiện (G1), gán cho người giữ vai lúc hạn đến; trễ hạn pháp lý; tỷ lệ gia hạn; thời gian
 * soát xét và SLA 2 ngày làm việc (G7). Mảng kiểm toán dùng hạn hồ sơ 04-F (AuditPeopleQuery).
 */
@Injectable()
export class CapabilityTeamQuery {
  constructor(private readonly prisma: PrismaService) {}

  /** Kỳ dịch vụ có hạn hiện hành trong kỳ báo cáo, mỗi kỳ gán cho người giữ vai `role` lúc hạn đến. */
  async periods(
    userIds: string[],
    role: TeamRole,
    period: Period,
    today: Date,
  ) {
    const teams = await this.prisma.serviceTeam.findMany({
      where: {
        contractService: {
          serviceType: { issuesAuditReport: false },
          contract: {
            deletedAt: null,
            status: { not: ContractStatus.CANCELLED },
          },
        },
      },
      select: {
        roleHistory: true,
        contractService: {
          select: {
            id: true,
            serviceType: { select: { name: true } },
            contract: {
              select: {
                id: true,
                code: true,
                customer: { select: { name: true } },
              },
            },
            tasks: PERIOD_TASKS,
          },
        },
      },
    });
    const now = new Date();
    const visible = new Set(userIds);
    const rows: (ReturnType<typeof periodOutcome> & {
      userId: string;
      key: string;
      line: (typeof teams)[number]['contractService'];
      periodKey: string;
    })[] = [];
    for (const team of teams) {
      const groups = new Map<
        string,
        (typeof team.contractService.tasks)[number][]
      >();
      for (const t of team.contractService.tasks) {
        const k = t.period ?? '—';
        groups.set(k, [...(groups.get(k) ?? []), t]);
      }
      for (const [periodKey, tasks] of groups) {
        const result = periodOutcome(
          tasks.map((t) => ({
            ...t,
            waits: t.clientWaits,
            extensions: t.dueChanges.length,
          })),
          today,
        );
        if (result.due < period.from || result.due > period.to) continue;
        const at = momentOf(result.due, result.reachedAt, now);
        for (const userId of holderAt(
          team.roleHistory,
          role as ServiceTeamRole,
          at,
        ))
          if (visible.has(userId))
            rows.push({
              ...result,
              userId,
              key: `${team.contractService.id}:${periodKey}`,
              line: team.contractService,
              periodKey,
            });
      }
    }
    return rows;
  }

  summarizePeriods(rows: Awaited<ReturnType<CapabilityTeamQuery['periods']>>) {
    return {
      total: rows.length,
      onTime: rows.filter((r) => r.current.result === 'ON_TIME').length,
      late: rows.filter((r) => r.current.result === 'LATE').length,
      overdue: rows.filter((r) => r.current.result === 'OVERDUE').length,
      rate: onTimeRate(rows.map((r) => r.current)),
      rateOriginal: onTimeRate(rows.map((r) => r.originalOutcome)),
      statutoryLate: rows.filter((r) => r.statutoryLate).length,
      extendedRate: ratePercent(
        rows.filter((r) => r.extended).length,
        rows.length,
      ),
    };
  }

  periodItems(rows: Awaited<ReturnType<CapabilityTeamQuery['periods']>>) {
    return rows
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .map((r) => ({
        key: r.key,
        contract: { id: r.line.contract.id, code: r.line.contract.code },
        customerName: r.line.contract.customer.name,
        service: r.line.serviceType.name,
        period: r.periodKey,
        due: formatBusinessDate(r.due),
        originalDue: formatBusinessDate(r.original),
        reachedAt: r.reachedAt,
        result: r.current.result,
        days: r.current.days,
        originalResult: r.originalOutcome.result,
        waitDays: r.waitDays,
        statutory: r.statutory,
        extended: r.extended,
      }));
  }

  /** G7: lượt soát xét người đó quyết định trong kỳ (ngày làm việc từ lúc vào cấp tới lúc quyết định). */
  async reviews(userIds: string[], period: Period, calendar: WorkingCalendar) {
    const VN = 7 * 3_600_000;
    const rows = await this.prisma.taskReview.findMany({
      where: {
        reviewerId: { in: userIds },
        decidedAt: {
          gte: new Date(period.from.getTime() - VN),
          lt: new Date(period.to.getTime() + 86_400_000 - VN),
        },
        task: { deletedAt: null },
      },
      select: {
        reviewerId: true,
        decision: true,
        enteredAt: true,
        decidedAt: true,
        task: { select: { id: true, code: true, title: true } },
      },
      orderBy: { decidedAt: 'asc' },
    });
    return rows.map((r) => {
      const days = workingDaysWaited(r.enteredAt, r.decidedAt, calendar);
      return { ...r, days, withinSla: days <= REVIEW_SLA_WORKING_DAYS };
    });
  }

  /** Việc đang chờ chính người đó soát xét quá SLA tại thời điểm xem. */
  async overSlaNow(userIds: string[], calendar: WorkingCalendar) {
    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        status: TaskStatus.IN_REVIEW,
        OR: [
          { reviewLevel: 1, reviewerId: { in: userIds } },
          { reviewLevel: 2, approverId: { in: userIds } },
        ],
      },
      select: {
        reviewLevel: true,
        reviewerId: true,
        approverId: true,
        updatedAt: true,
        statusEvents: {
          where: { toStatus: TaskStatus.IN_REVIEW },
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: { occurredAt: true },
        },
      },
    });
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const since = t.statusEvents[0]?.occurredAt ?? t.updatedAt;
      if (
        workingDaysWaited(since, new Date(), calendar) <=
        REVIEW_SLA_WORKING_DAYS
      )
        continue;
      const who = (t.reviewLevel === 2 ? t.approverId : t.reviewerId)!;
      counts.set(who, (counts.get(who) ?? 0) + 1);
    }
    return counts;
  }
}
