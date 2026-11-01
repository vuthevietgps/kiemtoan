import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { contractScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EFFECTIVE_STATUSES } from '../invoices/invoice.rules';
import { COUNTED_PAYMENT } from '../payments/payment-allocation';
import { RevenueMeasuresQueryDto } from './dto/report-query.dto';
import { approvedContractWhere } from './utils/contract-filter.util';
import {
  currentYear,
  formatBusinessDate,
  Period,
  resolvePeriod,
  vnDateOf,
} from './utils/period.util';
import {
  Entry,
  monthKey,
  RevenueGroup,
  revenueRows,
  revenueTotals,
  sameRangeLastYear,
} from './utils/revenue-measures';

type Owner = { id: string; fullName: string } | null;
type Party = {
  id: string;
  code: string;
  customer: { id: string; name: string };
  owner: Owner;
};
const PARTY = {
  id: true,
  code: true,
  customer: { select: { id: true, name: true } },
  owner: { select: { id: true, fullName: true } },
} satisfies Prisma.ContractSelect;
const NO_OWNER = { key: 'none', name: 'Chưa phân công' };
const between = (p: Period) => ({ gte: p.from, lte: p.to });

/** Khoá nhóm của một khoản (không theo loại dịch vụ — xem `contractEntries`). */
function groupOf(group: RevenueGroup, c: Party, date: Date, shift: number) {
  if (group === 'customer')
    return { key: c.customer.id, name: c.customer.name };
  if (group === 'owner')
    return c.owner ? { key: c.owner.id, name: c.owner.fullName } : NO_OWNER;
  const key = monthKey(date, shift);
  return { key, name: key };
}

/**
 * Báo cáo Doanh thu (đặc tả 10-D, M4–M5): 3 thước đo theo nhóm, so cùng kỳ năm trước, danh sách chi tiết
 * (HĐ duyệt / hoá đơn hiệu lực / phiếu thu Đã duyệt trong kỳ) để bấm nhóm ra đúng các dòng tạo nên số.
 * Phạm vi HĐ theo vai trò; quyền `reports:view_financial` do controller kiểm.
 */
@Injectable()
export class FinanceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async revenue(query: RevenueMeasuresQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentYear());
    const previous = sameRangeLastYear(period);
    const group = query.groupBy ?? 'serviceType';
    const [now, before] = await Promise.all([
      this.load(user, period, query.customerId),
      this.load(user, previous, query.customerId),
    ]);
    const sources = (d: typeof now, shift: number) => ({
      contractValue: d.contracts.flatMap((c) =>
        this.contractEntries(group, c, shift),
      ),
      invoiced: d.invoices.map((i): Entry => ({
        ...groupOf(group, i.contract, i.issueDate!, shift),
        amount: i.subtotal,
        contractId: i.contract.id,
      })),
      paid: d.payments.map((p): Entry => ({
        ...groupOf(group, p.contract, p.paidDate, shift),
        amount: p.amount,
        contractId: p.contract.id,
      })),
    });
    const cur = sources(now, 0);
    const prev = sources(before, 1);
    return {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(period.to),
      previousFrom: formatBusinessDate(previous.from),
      previousTo: formatBusinessDate(previous.to),
      groupBy: group,
      rows: revenueRows(cur, prev, group),
      totals: revenueTotals(cur, prev),
      details: this.details(now),
    };
  }

  private contractEntries(
    group: RevenueGroup,
    c: Awaited<ReturnType<FinanceReportsService['load']>>['contracts'][number],
    shift: number,
  ): Entry[] {
    if (group === 'serviceType')
      return c.services.map((s) => ({
        key: s.serviceType.id,
        name: s.serviceType.name,
        amount: s.amount,
        contractId: c.id,
      }));
    return [
      {
        ...groupOf(group, c, vnDateOf(c.approvedAt!), shift),
        amount: c.subtotal,
        contractId: c.id,
      },
    ];
  }

  private async load(user: AuthUser, period: Period, customerId?: string) {
    const contract: Prisma.ContractWhereInput = {
      AND: [
        contractScope(user),
        { deletedAt: null, ...(customerId && { customerId }) },
      ],
    };
    const [contracts, invoices, payments] = await Promise.all([
      this.prisma.contract.findMany({
        where: {
          AND: [
            approvedContractWhere(user, period),
            customerId ? { customerId } : {},
          ],
        },
        select: {
          ...PARTY,
          approvedAt: true,
          subtotal: true,
          services: {
            select: {
              amount: true,
              serviceType: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { approvedAt: 'asc' },
      }),
      this.prisma.invoice.findMany({
        where: {
          contract,
          status: { in: EFFECTIVE_STATUSES },
          issueDate: between(period),
        },
        select: {
          id: true,
          kind: true,
          templateCode: true,
          symbol: true,
          number: true,
          issueDate: true,
          subtotal: true,
          contract: { select: PARTY },
        },
        orderBy: { issueDate: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { ...COUNTED_PAYMENT, contract, paidDate: between(period) },
        select: {
          id: true,
          code: true,
          paidDate: true,
          amount: true,
          contract: { select: PARTY },
        },
        orderBy: { paidDate: 'asc' },
      }),
    ]);
    return { contracts, invoices, payments };
  }

  /** Danh sách chi tiết kỳ này, kèm khoá nhóm để giao diện lọc theo nhóm được bấm. */
  private details(d: Awaited<ReturnType<FinanceReportsService['load']>>) {
    const keys = (c: Party, date: Date) => ({
      contractId: c.id,
      contractCode: c.code,
      customerId: c.customer.id,
      customerName: c.customer.name,
      ownerId: c.owner?.id ?? NO_OWNER.key,
      month: monthKey(date),
    });
    return {
      contracts: d.contracts.map((c) => ({
        ...keys(c, vnDateOf(c.approvedAt!)),
        date: formatBusinessDate(vnDateOf(c.approvedAt!)),
        amount: c.subtotal,
        serviceTypeIds: [...new Set(c.services.map((s) => s.serviceType.id))],
      })),
      invoices: d.invoices.map((i) => ({
        ...keys(i.contract, i.issueDate!),
        id: i.id,
        kind: i.kind,
        identity: [i.templateCode, i.symbol, i.number]
          .filter(Boolean)
          .join(' · '),
        date: formatBusinessDate(i.issueDate!),
        amount: i.subtotal,
      })),
      payments: d.payments.map((p) => ({
        ...keys(p.contract, p.paidDate),
        id: p.id,
        code: p.code,
        date: formatBusinessDate(p.paidDate),
        amount: p.amount,
      })),
    };
  }
}
