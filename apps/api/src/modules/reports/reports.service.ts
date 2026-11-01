import { Injectable } from '@nestjs/common';
import { contractScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NON_REVENUE_STATUSES, todayVn } from './utils/period.util';
import {
  COUNTED_PAYMENT,
  INSTALLMENT_BALANCE_SELECT,
} from '../payments/payment-allocation';
import {
  summarizeReceivables,
  sumDecimals,
} from './utils/report-grouping.util';

/**
 * Công nợ theo KH (quy tắc chung 07-B) — giữ cho kiểm tra nhất quán công nợ và link CSV. Doanh thu, báo cáo
 * vận hành, đánh giá năng lực ở các service riêng (10-C → 10-E).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
