import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { xlsxWorkbook } from '../../common/types/xlsx-workbook';
import { contractScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { sumDecimal } from '../contracts/contract-calculator';
import { COUNTED_PAYMENT } from '../payments/payment-allocation';
import { BILLABLE_CONTRACT } from '../payments/payment.rules';
import { ReconciliationQueryDto } from './dto/invoice.dto';
import { EFFECTIVE_STATUSES, invoicedTotal, reconcile } from './invoice.rules';

/**
 * Đối chiếu thu – xuất (08 K8) theo HĐ đã duyệt: **đã thu** = phiếu thu Đã duyệt (07), **đã xuất** =
 * hoá đơn hiệu lực gồm VAT (kể cả điều chỉnh âm), **chờ xuất** = đề nghị chưa xuất. `to` = đối chiếu
 * đến ngày (phiếu theo ngày thu, hoá đơn theo ngày lập).
 */
@Injectable()
export class InvoicesReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconciliation(user: AuthUser, query: ReconciliationQueryDto) {
    const contracts = await this.contracts(user, query);
    const items = contracts
      .map((c) => {
        const paid = sumDecimal(c.payments.map((p) => p.amount));
        const invoiced = invoicedTotal(c.invoices);
        const requested = sumDecimal(
          c.invoices
            .filter((i) => i.status === InvoiceStatus.REQUESTED)
            .map((i) => i.total),
        );
        return {
          contractId: c.id,
          code: c.code,
          status: c.status,
          customer: c.customer,
          total: c.total,
          paid,
          invoiced,
          requested,
          ...reconcile(paid, invoiced),
        };
      })
      .filter(
        (r) =>
          !query.mismatchOnly ||
          r.paidNotInvoiced.gt(0) ||
          r.invoicedNotPaid.gt(0),
      );
    const sum = (
      key:
        | 'total'
        | 'paid'
        | 'invoiced'
        | 'requested'
        | 'paidNotInvoiced'
        | 'invoicedNotPaid',
    ) => sumDecimal(items.map((i) => i[key]));
    return {
      items,
      summary: {
        total: sum('total'),
        paid: sum('paid'),
        invoiced: sum('invoiced'),
        requested: sum('requested'),
        paidNotInvoiced: sum('paidNotInvoiced'),
        invoicedNotPaid: sum('invoicedNotPaid'),
      },
    };
  }

  /** HĐ đã duyệt trong phạm vi kèm phiếu đã duyệt và hoá đơn (hiệu lực + chờ xuất) tới ngày `to`. */
  private contracts(user: AuthUser, query: ReconciliationQueryDto) {
    const to = query.to ? new Date(query.to) : undefined;
    const search = query.search?.trim();
    return this.prisma.contract.findMany({
      where: {
        AND: [
          contractScope(user),
          {
            deletedAt: null,
            status: { in: BILLABLE_CONTRACT },
            customerId: query.customerId,
            ...(search && {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                {
                  customer: { name: { contains: search, mode: 'insensitive' } },
                },
              ],
            }),
          },
        ],
      },
      select: {
        id: true,
        code: true,
        status: true,
        total: true,
        customer: { select: { id: true, name: true, taxCode: true } },
        payments: {
          where: { ...COUNTED_PAYMENT, ...(to && { paidDate: { lte: to } }) },
          select: { amount: true },
        },
        invoices: {
          where: {
            OR: [
              {
                status: { in: EFFECTIVE_STATUSES },
                ...(to && { issueDate: { lte: to } }),
              },
              { status: InvoiceStatus.REQUESTED },
            ],
          },
          select: { status: true, total: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  /** Excel đối chiếu thu – xuất (cùng số với màn hình), tiền là ô số. */
  async exportReconciliation(user: AuthUser, query: ReconciliationQueryDto) {
    const { items, summary } = await this.reconciliation(user, query);
    const n = (v: Prisma.Decimal) => v.toNumber();
    return xlsxWorkbook(
      [
        [
          'Mã HĐ',
          'Khách hàng',
          'MST',
          'Tổng thanh toán HĐ',
          'Đã thu (đã duyệt)',
          'Đã xuất hoá đơn',
          'Đang chờ xuất',
          'Đã thu chưa xuất',
          'Đã xuất chưa thu',
        ],
        ...items.map((i) => [
          i.code,
          i.customer.name,
          i.customer.taxCode,
          n(i.total),
          n(i.paid),
          n(i.invoiced),
          n(i.requested),
          n(i.paidNotInvoiced),
          n(i.invoicedNotPaid),
        ]),
        [
          `Tổng cộng (${items.length} HĐ)`,
          '',
          '',
          n(summary.total),
          n(summary.paid),
          n(summary.invoiced),
          n(summary.requested),
          n(summary.paidNotInvoiced),
          n(summary.invoicedNotPaid),
        ],
      ],
      'Doi chieu thu xuat',
    );
  }
}
