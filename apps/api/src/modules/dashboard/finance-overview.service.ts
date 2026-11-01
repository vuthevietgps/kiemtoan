import { Injectable } from '@nestjs/common';
import { Prisma, ServiceStatus } from '@prisma/client';
import { contractScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { COUNTED_PAYMENT } from '../payments/payment-allocation';
import {
  changePercent,
  currentMonth,
  formatBusinessDate,
  NON_REVENUE_STATUSES,
  Period,
  previousPeriod,
  resolvePeriod,
} from '../reports/utils/period.util';
import { approvedContractWhere } from '../reports/utils/contract-filter.util';
import { sumDecimals } from '../reports/utils/report-grouping.util';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const ZERO = new Prisma.Decimal(0);
/**
 * Tab Tài chính của tổng quan (đặc tả 10, M1, M4, M5): 5 thẻ G (giá trị HĐ trước / gồm VAT so kỳ liền
 * trước, số HĐ hiệu lực / mới duyệt, dịch vụ hoàn thành / chưa), 3 biểu đồ, HĐ gần đây. Chỉ người có
 * `finance:view` (controller kiểm). Đã thu theo phiếu Đã duyệt (07).
 */
@Injectable()
export class FinanceOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: DashboardQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentMonth());
    const previous = previousPeriod(period);
    const [kpis, charts, recentContracts] = await Promise.all([
      this.kpis(user, period, previous),
      this.charts(user, period),
      this.recentContracts(user),
    ]);
    return {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(period.to),
      previousFrom: formatBusinessDate(previous.from),
      previousTo: formatBusinessDate(previous.to),
      kpis,
      ...charts,
      recentContracts,
    };
  }

  private async kpis(user: AuthUser, period: Period, previous: Period) {
    const where = approvedContractWhere(user, period);
    const [current, before, effective, servicesTotal, servicesDone] =
      await Promise.all([
        this.prisma.contract.aggregate({
          where,
          _sum: { subtotal: true, total: true },
          _count: { _all: true },
        }),
        this.prisma.contract.aggregate({
          where: approvedContractWhere(user, previous),
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
    const money = (
      value: Prisma.Decimal | null,
      prev: Prisma.Decimal | null,
    ) => {
      const v = value ?? ZERO;
      const p = prev ?? ZERO;
      // M5: kỳ so sánh bằng 0 → không so được (null → giao diện hiện "—"), kể cả khi kỳ này cũng 0.
      return {
        value: v,
        previous: p,
        changePercent: p.isZero() ? null : changePercent(v, p),
      };
    };
    return {
      revenue: money(current._sum.subtotal, before._sum.subtotal),
      totalPayable: money(current._sum.total, before._sum.total),
      contracts: { total: effective, new: current._count._all },
      servicesDone,
      servicesTotal,
    };
  }

  private async charts(user: AuthUser, period: Period) {
    const where = approvedContractWhere(user, period);
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
        serviceTypeId: b.serviceTypeId,
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
}
