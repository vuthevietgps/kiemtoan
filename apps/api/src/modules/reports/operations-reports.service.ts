import { Injectable } from '@nestjs/common';
import { ContractStatus, ObligationStatus, Prisma } from '@prisma/client';
import {
  contractScope,
  customerScope,
  taskScope,
} from '../../core/access-control/data-scope';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OperationsReportQueryDto } from './dto/report-query.dto';
import {
  complianceOutcome,
  contractCategories,
  ContractSpan,
  customerFlow,
  groupCompliance,
  ratio,
} from './utils/operations-report.rules';
import {
  currentYear,
  formatBusinessDate,
  NON_REVENUE_STATUSES,
  Period,
  resolvePeriod,
  todayVn,
  vnDateOf,
} from './utils/period.util';

/** Ngưỡng "sắp hết hạn" như danh sách HĐ sắp hết hạn 04-D (M7). */
export const EXPIRING_DAYS = 30;
const ACTIVE_RENEWAL = {
  deletedAt: null,
  status: { not: ContractStatus.CANCELLED },
} satisfies Prisma.ContractWhereInput;
const day = (d: Date | null) => (d ? formatBusinessDate(d) : null);
const between = (p: Period) => ({ gte: p.from, lte: p.to });

/**
 * Báo cáo vận hành (đặc tả 10-C): Tuân thủ deadline (M6), Hợp đồng (M7), Khách hàng (M8). Mọi báo cáo
 * trả `summary` (con số), nhóm và `items` (danh sách chi tiết tái lập được con số). Phạm vi dữ liệu theo
 * vai trò; giá trị HĐ chỉ có khi người xem có `finance:view`.
 */
@Injectable()
export class OperationsReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** M6: lịch báo cáo 06 có hạn trong kỳ (bỏ "Không áp dụng") + việc pháp lý không gắn nghĩa vụ. */
  async deadlineCompliance(query: OperationsReportQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentYear());
    const today = todayVn();
    const items = (await this.complianceSources(user, period, query.customerId))
      .map((i) => ({ ...i, ...complianceOutcome(i.dueDate, i.doneOn, today) }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    return {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(period.to),
      ...groupCompliance(items),
      items: items.map((i) => ({
        kind: i.kind,
        id: i.id,
        title: i.title,
        customerId: i.customer.id,
        customerName: i.customer.name,
        dueDate: day(i.dueDate),
        doneOn: day(i.doneOn),
        outcome: i.outcome,
        daysLate: i.daysLate,
        clientDelay: i.clientDelay,
      })),
    };
  }

  /** Nguồn M6: kỳ báo cáo (ngày nộp) và việc pháp lý không gắn nghĩa vụ (ngày hoàn thành, giờ VN). */
  private async complianceSources(
    user: AuthUser,
    period: Period,
    customerId?: string,
  ) {
    const customer = {
      AND: [{ deletedAt: null }, customerScope(user)],
      ...(customerId && { id: customerId }),
    };
    const confirmedWait = { confirmedAt: { not: null } };
    const [obligations, tasks] = await Promise.all([
      this.prisma.customerObligation.findMany({
        where: {
          dueDate: between(period),
          status: { not: ObligationStatus.NOT_APPLICABLE },
          customer,
        },
        select: {
          id: true,
          period: true,
          dueDate: true,
          status: true,
          filedAt: true,
          customer: { select: { id: true, name: true } },
          obligationType: { select: { name: true } },
          tasks: {
            where: { deletedAt: null, clientWaits: { some: confirmedWait } },
            select: { id: true },
          },
        },
      }),
      this.prisma.task.findMany({
        where: {
          AND: [
            taskScope(user),
            {
              deletedAt: null,
              isStatutory: true,
              obligationId: null,
              dueDate: between(period),
              customer,
            },
          ],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          completedAt: true,
          customer: { select: { id: true, name: true } },
          clientWaits: { where: confirmedWait, select: { id: true } },
        },
      }),
    ]);
    return [
      ...obligations.map((o) => ({
        kind: 'OBLIGATION' as const,
        id: o.id,
        title: `${o.obligationType.name} kỳ ${o.period}`,
        customer: o.customer,
        dueDate: o.dueDate,
        doneOn:
          o.status === ObligationStatus.FILED ? (o.filedAt ?? null) : null,
        clientDelay: o.tasks.length > 0,
      })),
      ...tasks.map((t) => ({
        kind: 'TASK' as const,
        id: t.id,
        title: t.title,
        customer: t.customer,
        dueDate: t.dueDate,
        doneOn: t.completedAt ? vnDateOf(t.completedAt) : null,
        clientDelay: t.clientWaits.length > 0,
      })),
    ];
  }

  /** M7: mới duyệt, hiệu lực cuối kỳ, sắp hết hạn (30 ngày sau cuối kỳ), tỷ lệ tái ký. */
  async contracts(query: OperationsReportQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentYear());
    const money = hasPermission(user, 'finance', 'view');
    const rows = await this.prisma.contract.findMany({
      where: {
        AND: [
          contractScope(user),
          {
            deletedAt: null,
            status: { notIn: NON_REVENUE_STATUSES },
            approvedAt: { not: null },
            ...(query.customerId && { customerId: query.customerId }),
          },
        ],
      },
      select: {
        id: true,
        code: true,
        status: true,
        approvedAt: true,
        startDate: true,
        endDate: true,
        subtotal: true,
        customer: { select: { id: true, name: true } },
        owner: { select: { fullName: true } },
        renewals: { where: ACTIVE_RENEWAL, select: { code: true } },
      },
      orderBy: [{ code: 'asc' }],
    });
    const end = period.to;
    const items = rows.map((c) => {
      const span: ContractSpan = {
        approvedOn: vnDateOf(c.approvedAt!),
        startDate: c.startDate,
        endDate: c.endDate,
      };
      const categories = contractCategories(
        span,
        c.renewals.length > 0,
        period,
        EXPIRING_DAYS,
      );
      return {
        id: c.id,
        code: c.code,
        status: c.status,
        customerId: c.customer.id,
        customerName: c.customer.name,
        ownerName: c.owner?.fullName ?? null,
        approvedOn: day(span.approvedOn),
        startDate: day(c.startDate),
        endDate: day(c.endDate),
        renewedBy: c.renewals.map((r) => r.code),
        ...(money && { subtotal: c.subtotal }),
        categories,
      };
    });
    const count = (k: string) =>
      items.filter((i) => i.categories.includes(k)).length;
    return {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(end),
      expiringDays: EXPIRING_DAYS,
      summary: {
        newApproved: count('NEW'),
        active: count('ACTIVE'),
        expiring: count('EXPIRING'),
        ended: count('ENDED'),
        renewed: count('RENEWED'),
        renewalRate: ratio(count('RENEWED'), count('ENDED')),
      },
      items: items.filter((i) => i.categories.length),
    };
  }

  /** M8: khách hàng mới / ngừng / giữ chân, tính theo hợp đồng đã duyệt. */
  async customers(query: OperationsReportQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentYear());
    const customers = await this.prisma.customer.findMany({
      where: {
        AND: [{ deletedAt: null }, customerScope(user)],
        ...(query.customerId && { id: query.customerId }),
      },
      select: {
        id: true,
        name: true,
        taxCode: true,
        owner: { select: { fullName: true } },
        contracts: {
          where: {
            deletedAt: null,
            status: { notIn: NON_REVENUE_STATUSES },
            approvedAt: { not: null },
          },
          select: { approvedAt: true, startDate: true, endDate: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    const items = customers
      .filter((c) => c.contracts.length)
      .map((c) => {
        const flow = customerFlow(
          c.contracts.map((k) => ({
            approvedOn: vnDateOf(k.approvedAt!),
            startDate: k.startDate,
            endDate: k.endDate,
          })),
          period,
        );
        return {
          id: c.id,
          name: c.name,
          taxCode: c.taxCode,
          ownerName: c.owner?.fullName ?? null,
          firstApprovedOn: day(flow.firstApprovedOn),
          stoppedOn: day(flow.stoppedOn),
          isNew: flow.isNew,
          stopped: flow.stopped,
          activeAtStart: flow.activeAtStart,
          activeAtEnd: flow.activeAtEnd,
          retained: flow.activeAtStart && flow.activeAtEnd,
        };
      });
    const n = (pick: (i: (typeof items)[number]) => boolean) =>
      items.filter(pick).length;
    return {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(period.to),
      summary: {
        newCustomers: n((i) => i.isNew),
        stopped: n((i) => i.stopped),
        activeAtStart: n((i) => i.activeAtStart),
        activeAtEnd: n((i) => i.activeAtEnd),
        retained: n((i) => i.retained),
        retentionRate: ratio(
          n((i) => i.retained),
          n((i) => i.activeAtStart),
        ),
      },
      items: items.filter(
        (i) => i.isNew || i.stopped || i.activeAtStart || i.activeAtEnd,
      ),
    };
  }
}
