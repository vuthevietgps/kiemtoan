import { Injectable } from '@nestjs/common';
import { Prisma, ServiceStatus, TaskStatus } from '@prisma/client';
import { contractScope, taskScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { COUNTED_PAYMENT } from '../payments/payment-allocation';
import { revenueContractWhere } from '../reports/utils/contract-filter.util';
import {
  addDays,
  changePercent,
  currentMonth,
  daysBetween,
  formatBusinessDate,
  NON_REVENUE_STATUSES,
  Period,
  previousPeriod,
  resolvePeriod,
  todayVn,
} from '../reports/utils/period.util';
import { sumDecimals } from '../reports/utils/report-grouping.util';
import {
  STATUS_GROUPS,
  StatusGroup,
  statusGroup,
} from '../tasks/task-status.rules';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const ZERO = new Prisma.Decimal(0);

const TASK_ITEM_SELECT = {
  id: true,
  title: true,
  dueDate: true,
  status: true,
  completedAt: true,
  customer: { select: { name: true } },
  assignee: { select: { fullName: true } },
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_ITEM_SELECT }>;

function toTaskItem(task: TaskRow, today: Date) {
  return {
    id: task.id,
    title: task.title,
    customerName: task.customer.name,
    assigneeName: task.assignee?.fullName ?? null,
    status: task.status,
    dueDate: formatBusinessDate(task.dueDate),
    completedAt: task.completedAt,
    daysLeft: daysBetween(today, task.dueDate),
  };
}

/**
 * Tổng quan: số liệu đọc trực tiếp từ hợp đồng, dòng dịch vụ, thu tiền, công việc
 * và luôn lọc theo phạm vi dữ liệu của người xem (quản trị hệ thống không có phạm vi → số 0).
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: DashboardQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentMonth());
    const previous = previousPeriod(period);
    const today = todayVn();
    const [kpis, charts, recentContracts, tasks] = await Promise.all([
      this.kpis(user, period, previous),
      this.charts(user, period),
      this.recentContracts(user),
      this.tasks(user, today),
    ]);
    return {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(period.to),
      previousFrom: formatBusinessDate(previous.from),
      previousTo: formatBusinessDate(previous.to),
      kpis,
      ...charts,
      recentContracts,
      ...tasks,
    };
  }

  private async kpis(user: AuthUser, period: Period, previous: Period) {
    const where = revenueContractWhere(user, period);
    const [current, before, effective, servicesTotal, servicesDone] =
      await Promise.all([
        this.prisma.contract.aggregate({
          where,
          _sum: { subtotal: true, total: true },
          _count: { _all: true },
        }),
        this.prisma.contract.aggregate({
          where: revenueContractWhere(user, previous),
          _sum: { subtotal: true, total: true },
        }),
        // Hợp đồng còn hiệu lực trong kỳ: bắt đầu trước cuối kỳ, chưa kết thúc trước đầu kỳ.
        this.prisma.contract.count({
          where: {
            AND: [
              contractScope(user),
              {
                deletedAt: null,
                status: { notIn: NON_REVENUE_STATUSES },
                startDate: { lte: period.to },
                OR: [{ endDate: null }, { endDate: { gte: period.from } }],
              },
            ],
          },
        }),
        this.prisma.contractService.count({ where: { contract: where } }),
        this.prisma.contractService.count({
          where: { contract: where, status: ServiceStatus.COMPLETED },
        }),
      ]);
    const revenue = current._sum.subtotal ?? ZERO;
    const totalPayable = current._sum.total ?? ZERO;
    const prevRevenue = before._sum.subtotal ?? ZERO;
    const prevPayable = before._sum.total ?? ZERO;
    return {
      revenue: {
        value: revenue,
        previous: prevRevenue,
        changePercent: changePercent(revenue, prevRevenue),
      },
      totalPayable: {
        value: totalPayable,
        previous: prevPayable,
        changePercent: changePercent(totalPayable, prevPayable),
      },
      contracts: { total: effective, new: current._count._all },
      servicesDone,
      servicesTotal,
    };
  }

  private async charts(user: AuthUser, period: Period) {
    const where = revenueContractWhere(user, period);
    const [byType, statusCounts, contracts] = await Promise.all([
      this.prisma.contractService.groupBy({
        by: ['serviceTypeId'],
        where: { contract: where },
        _sum: { amount: true },
      }),
      this.prisma.contractService.groupBy({
        by: ['status'],
        where: { contract: where },
        _count: { _all: true },
      }),
      this.prisma.contract.findMany({
        where,
        select: {
          total: true,
          payments: { where: COUNTED_PAYMENT, select: { amount: true } },
        },
      }),
    ]);
    const types = await this.prisma.serviceType.findMany({
      where: { id: { in: byType.map((b) => b.serviceTypeId) } },
      select: { id: true, name: true },
    });
    const revenueByServiceType = byType
      .map((b) => ({
        name: types.find((t) => t.id === b.serviceTypeId)?.name ?? '',
        amount: b._sum.amount ?? ZERO,
      }))
      .sort((a, b) => b.amount.comparedTo(a.amount));
    const completed =
      statusCounts.find((s) => s.status === ServiceStatus.COMPLETED)?._count
        ._all ?? 0;
    const allServices = statusCounts.reduce((n, s) => n + s._count._all, 0);
    const total = sumDecimals(contracts.map((c) => c.total));
    const paid = sumDecimals(
      contracts.flatMap((c) => c.payments.map((p) => p.amount)),
    );
    const remaining = total.minus(paid);
    return {
      revenueByServiceType,
      serviceStatus: { completed, notCompleted: allServices - completed },
      paymentStatus: {
        paid,
        remaining: remaining.isNegative() ? ZERO : remaining,
      },
    };
  }

  private async recentContracts(user: AuthUser) {
    const contracts = await this.prisma.contract.findMany({
      where: { AND: [contractScope(user), { deletedAt: null }] },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        code: true,
        status: true,
        subtotal: true,
        total: true,
        customer: { select: { name: true } },
        services: { select: { serviceType: { select: { name: true } } } },
        payments: { where: COUNTED_PAYMENT, select: { amount: true } },
      },
    });
    return contracts.map((c) => ({
      id: c.id,
      code: c.code,
      customerName: c.customer.name,
      serviceTypes: [...new Set(c.services.map((s) => s.serviceType.name))],
      subtotal: c.subtotal,
      total: c.total,
      status: c.status,
      paidAmount: sumDecimals(c.payments.map((p) => p.amount)),
    }));
  }

  private async tasks(user: AuthUser, today: Date) {
    const mine: Prisma.TaskWhereInput = {
      assigneeId: user.id,
      deletedAt: null,
    };
    const notDone = { not: TaskStatus.COMPLETED };
    const [counts, todo, inProgress, done, upcoming, deadlines] =
      await Promise.all([
        this.prisma.task.groupBy({
          by: ['status'],
          where: mine,
          _count: { _all: true },
        }),
        this.myTasks(mine, 'TODO'),
        this.myTasks(mine, 'IN_PROGRESS'),
        this.myTasks(mine, 'DONE'),
        this.prisma.task.findMany({
          where: {
            AND: [
              { OR: [{ assigneeId: user.id }, taskScope(user)] },
              {
                deletedAt: null,
                status: notDone,
                dueDate: { gte: today, lte: addDays(today, 14) },
              },
            ],
          },
          orderBy: { dueDate: 'asc' },
          take: 5,
          select: TASK_ITEM_SELECT,
        }),
        this.prisma.task.findMany({
          where: {
            AND: [taskScope(user), { deletedAt: null, status: notDone }],
          },
          orderBy: { dueDate: 'asc' },
          take: 5,
          select: TASK_ITEM_SELECT,
        }),
      ]);
    // Ba nhóm trạng thái (05: Chưa làm / Đang làm / Hoàn thành) giữ khoá cũ cho giao diện hiện tại.
    const count = (group: StatusGroup) =>
      counts
        .filter((c) => statusGroup(c.status) === group)
        .reduce((sum, c) => sum + c._count._all, 0);
    const item = (t: TaskRow) => toTaskItem(t, today);
    return {
      myTasks: {
        TODO: count('TODO'),
        IN_PROGRESS: count('IN_PROGRESS'),
        DONE: count('DONE'),
      },
      myTaskItems: {
        TODO: todo.map(item),
        IN_PROGRESS: inProgress.map(item),
        DONE: done.map(item),
      },
      upcoming: upcoming.map(item),
      reportDeadlines: deadlines.map(item),
    };
  }

  private myTasks(mine: Prisma.TaskWhereInput, group: StatusGroup) {
    return this.prisma.task.findMany({
      where: { ...mine, status: { in: [...STATUS_GROUPS[group]] } },
      orderBy:
        group === 'DONE'
          ? { completedAt: { sort: 'desc', nulls: 'last' } }
          : { dueDate: 'asc' },
      take: 5,
      select: TASK_ITEM_SELECT,
    });
  }
}
