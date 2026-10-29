import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  addAging,
  AGING_KEYS,
  agingOf,
  emptyAging,
  installmentStates,
  upcomingAmount,
} from '../../common/receivables';
import { xlsxWorkbook } from '../../common/types/xlsx-workbook';
import { contractScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { sumDecimal } from '../contracts/contract-calculator';
import { todayVn } from '../reports/utils/period.util';
import { DueInstallmentQueryDto, ReceivableQueryDto } from './dto/payment.dto';
import {
  balancesOf,
  contractReceivable,
  COUNTED_PAYMENT,
  INSTALLMENT_BALANCE_SELECT,
  RECEIVABLE_EXCLUDED,
} from './payment-allocation';

const AGING_HEADERS = [
  'Chưa đến hạn',
  '1–30 ngày',
  '31–60 ngày',
  '61–90 ngày',
  'Trên 90 ngày',
];

/**
 * Công nợ phải thu (07-D1, J12): theo HĐ kèm đợt còn nợ và tuổi nợ, danh sách đợt sắp đến hạn / quá
 * hạn, file Excel. Đọc phân bổ đã lưu qua quy tắc chung; phạm vi theo HĐ người dùng được xem.
 */
@Injectable()
export class ReceivablesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Công nợ theo HĐ còn phải thu: tuổi nợ theo đợt, sắp đến hạn 7 ngày, chờ duyệt, tổng cộng. */
  async receivables(
    user: AuthUser,
    query: ReceivableQueryDto,
    today = todayVn(),
  ) {
    const contracts = await this.contracts(user, query);
    const pending = await this.pendingByContract(contracts.map((c) => c.id));
    const items = contracts
      .map((c) => {
        const summary = contractReceivable(c, today);
        const states = installmentStates(balancesOf(c.installments), today);
        const open = c.installments
          .map((i, index) => ({ ...i, ...states[index] }))
          .filter((i) => i.remaining.gt(0))
          .map((i) => ({
            id: i.id,
            name: i.name,
            amount: i.amount,
            dueDate: i.dueDate,
            remaining: i.remaining,
            dueInDays: i.dueInDays,
            overdueDays: i.overdueDays,
            bucket: i.bucket,
            awaitingMilestone: i.dueInDays === null,
            dueOffsetDays: i.dueOffsetDays,
          }));
        return {
          contractId: c.id,
          code: c.code,
          customer: c.customer,
          owner: c.owner,
          status: c.status,
          total: c.total,
          ...summary,
          pendingAmount: pending.get(c.id) ?? new Prisma.Decimal(0),
          upcomingAmount: upcomingAmount(states),
          aging: agingOf(summary.remaining, states),
          installments: open,
        };
      })
      .filter((r) => r.remaining.gt(0));
    const summary = {
      total: sumDecimal(items.map((i) => i.total)),
      paid: sumDecimal(items.map((i) => i.paid)),
      remaining: sumDecimal(items.map((i) => i.remaining)),
      overdueAmount: sumDecimal(items.map((i) => i.overdueAmount)),
      pendingAmount: sumDecimal(items.map((i) => i.pendingAmount)),
      upcomingAmount: sumDecimal(items.map((i) => i.upcomingAmount)),
      aging: items.reduce((acc, i) => addAging(acc, i.aging), emptyAging()),
    };
    return { items, summary };
  }

  /**
   * Đợt còn nợ **sắp đến hạn** (trong `days` ngày tới, kể cả hôm nay) hoặc **quá hạn** — danh sách làm
   * việc của Kế toán thu tiền (lập phiếu, đề nghị thanh toán, nhắc nợ).
   */
  async dueInstallments(
    user: AuthUser,
    query: DueInstallmentQueryDto,
    today = todayVn(),
  ) {
    const days = query.days ?? 7;
    const { items } = await this.receivables(user, query, today);
    const rows = items.flatMap((c) =>
      c.installments
        .filter((i) =>
          query.due === 'overdue'
            ? i.overdueDays !== null
            : i.dueInDays !== null && i.dueInDays >= 0 && i.dueInDays <= days,
        )
        .map((i) => ({
          ...i,
          contract: { id: c.contractId, code: c.code, status: c.status },
          customer: c.customer,
          owner: c.owner,
          pendingAmount: c.pendingAmount,
        })),
    );
    rows.sort((a, b) =>
      query.due === 'overdue'
        ? b.overdueDays! - a.overdueDays! ||
          a.contract.code.localeCompare(b.contract.code)
        : a.dueInDays! - b.dueInDays! ||
          a.contract.code.localeCompare(b.contract.code),
    );
    return { items: rows, total: sumDecimal(rows.map((r) => r.remaining)) };
  }

  /** Excel công nợ theo HĐ, có cột tuổi nợ (cùng số với màn hình). */
  async exportReceivables(user: AuthUser, query: ReceivableQueryDto) {
    const { items, summary } = await this.receivables(user, query);
    const money = (v: Prisma.Decimal) => v.toNumber();
    return xlsxWorkbook(
      [
        [
          'Mã HĐ',
          'Khách hàng',
          'Phụ trách',
          'Tổng thanh toán',
          'Đã thu',
          'Còn phải thu',
          'Chờ duyệt',
          ...AGING_HEADERS,
        ],
        ...items.map((i) => [
          i.code,
          i.customer.name,
          i.owner?.fullName ?? '',
          money(i.total),
          money(i.paid),
          money(i.remaining),
          money(i.pendingAmount),
          ...AGING_KEYS.map((k) => money(i.aging[k])),
        ]),
        [
          `Tổng cộng (${items.length} HĐ)`,
          '',
          '',
          money(summary.total),
          money(summary.paid),
          money(summary.remaining),
          money(summary.pendingAmount),
          ...AGING_KEYS.map((k) => money(summary.aging[k])),
        ],
      ],
      'Cong no',
    );
  }

  private contracts(user: AuthUser, query: ReceivableQueryDto) {
    const search = query.search?.trim();
    return this.prisma.contract.findMany({
      where: {
        AND: [
          contractScope(user),
          {
            deletedAt: null,
            status: { notIn: RECEIVABLE_EXCLUDED },
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
      include: {
        customer: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
        installments: {
          select: INSTALLMENT_BALANCE_SELECT,
          orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
        },
        payments: { where: COUNTED_PAYMENT, select: { amount: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  /** J2: tiền phiếu Chờ duyệt — hiện riêng, không tính đã thu. */
  private async pendingByContract(contractIds: string[]) {
    const sums = await this.prisma.payment.groupBy({
      by: ['contractId'],
      where: {
        contractId: { in: contractIds },
        deletedAt: null,
        status: 'PENDING',
      },
      _sum: { amount: true },
    });
    return new Map(
      sums.map((s) => [s.contractId, s._sum.amount ?? new Prisma.Decimal(0)]),
    );
  }
}
