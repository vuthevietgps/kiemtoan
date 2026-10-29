import { Injectable } from '@nestjs/common';
import { Prisma, Role, TaskStatus } from '@prisma/client';
import {
  contractScope,
  dataScopeOf,
  taskScope,
} from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  ReportPeriodQueryDto,
  RevenueReportQueryDto,
} from './dto/report-query.dto';
import {
  currentYear,
  formatBusinessDate,
  isOnTime,
  NON_REVENUE_STATUSES,
  periodMoments,
  ratePercent,
  resolvePeriod,
  todayVn,
} from './utils/period.util';
import {
  COUNTED_PAYMENT,
  INSTALLMENT_BALANCE_SELECT,
} from '../payments/payment-allocation';
import { revenueContractWhere } from './utils/contract-filter.util';
import {
  groupRevenue,
  summarizeCompliance,
  summarizeReceivables,
  sumDecimals,
} from './utils/report-grouping.util';

/** Báo cáo chỉ đọc. Mọi số liệu lọc theo phạm vi dữ liệu của người xem. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async revenue(query: RevenueReportQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentYear());
    const contracts = await this.prisma.contract.findMany({
      where: revenueContractWhere(user, period),
      select: {
        id: true,
        startDate: true,
        subtotal: true,
        total: true,
        vatRate: true,
        customer: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
        services: {
          select: {
            amount: true,
            serviceType: { select: { id: true, name: true } },
          },
        },
      },
    });
    const rows = groupRevenue(contracts, query.groupBy, period);
    return {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(period.to),
      groupBy: query.groupBy,
      rows,
      totals: {
        contracts: contracts.length,
        subtotal: sumDecimals(rows.map((r) => r.subtotal)),
        total: sumDecimals(rows.map((r) => r.total)),
      },
    };
  }

  async receivables(user: AuthUser) {
    const contracts = await this.prisma.contract.findMany({
      where: {
        AND: [
          contractScope(user),
          { deletedAt: null, status: { notIn: NON_REVENUE_STATUSES } },
        ],
      },
      select: {
        total: true,
        customer: { select: { id: true, name: true, taxCode: true } },
        installments: { select: INSTALLMENT_BALANCE_SELECT },
        payments: { where: COUNTED_PAYMENT, select: { amount: true } },
      },
    });
    const rows = summarizeReceivables(contracts, todayVn());
    return {
      rows,
      totals: {
        total: sumDecimals(rows.map((r) => r.total)),
        paid: sumDecimals(rows.map((r) => r.paid)),
        remaining: sumDecimals(rows.map((r) => r.remaining)),
        overdue: sumDecimals(rows.map((r) => r.overdue)),
      },
    };
  }

  async taskCompliance(query: ReportPeriodQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentYear());
    const tasks = await this.prisma.task.findMany({
      where: {
        AND: [
          taskScope(user),
          { deletedAt: null, dueDate: { gte: period.from, lte: period.to } },
        ],
      },
      select: {
        dueDate: true,
        status: true,
        completedAt: true,
        assignee: { select: { id: true, fullName: true } },
      },
    });
    return summarizeCompliance(tasks, period, todayVn());
  }

  /** Người dùng được xem hiệu suất: toàn công ty / cả nhóm / chỉ bản thân. */
  private staffWhere(user: AuthUser): Prisma.UserWhereInput {
    const base: Prisma.UserWhereInput = {
      deletedAt: null,
      role: { in: [Role.STAFF, Role.MANAGER] },
    };
    const scope = dataScopeOf(user);
    if (scope === 'ALL') return base;
    if (scope === 'TEAM') {
      return { ...base, OR: [{ id: user.id }, { teamId: user.teamId }] };
    }
    if (scope === 'OWN') return { ...base, id: user.id };
    return { id: { in: [] } };
  }

  async staffPerformance(query: ReportPeriodQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentYear());
    const staff = await this.prisma.user.findMany({
      where: this.staffWhere(user),
      select: {
        id: true,
        fullName: true,
        role: true,
        team: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    const ids = staff.map((s) => s.id);
    const [tasks, customers, revenue] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          status: TaskStatus.COMPLETED,
          assigneeId: { in: ids },
          completedAt: periodMoments(period),
        },
        select: { assigneeId: true, dueDate: true, completedAt: true },
      }),
      this.prisma.customer.groupBy({
        by: ['ownerId'],
        where: { deletedAt: null, ownerId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.contract.groupBy({
        by: ['ownerId'],
        where: {
          deletedAt: null,
          ownerId: { in: ids },
          status: { notIn: NON_REVENUE_STATUSES },
          startDate: { gte: period.from, lte: period.to },
        },
        _sum: { subtotal: true },
      }),
    ]);
    const rows = staff.map((s) => {
      const done = tasks.filter((t) => t.assigneeId === s.id);
      const onTime = done.filter(
        (t) => !t.completedAt || isOnTime(t.completedAt, t.dueDate),
      ).length;
      return {
        userId: s.id,
        fullName: s.fullName,
        role: s.role,
        teamName: s.team?.name ?? null,
        tasksDone: done.length,
        onTime,
        late: done.length - onTime,
        onTimeRate: ratePercent(onTime, done.length),
        customers: customers.find((c) => c.ownerId === s.id)?._count._all ?? 0,
        revenue:
          revenue.find((r) => r.ownerId === s.id)?._sum.subtotal ??
          new Prisma.Decimal(0),
      };
    });
    return {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(period.to),
      rows,
    };
  }
}
