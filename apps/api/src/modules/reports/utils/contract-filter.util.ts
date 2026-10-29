import { Prisma } from '@prisma/client';
import { contractScope } from '../../../core/access-control/data-scope';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { NON_REVENUE_STATUSES, Period } from './period.util';

/** Hợp đồng tính doanh thu trong kỳ: trong phạm vi, chưa xoá, đã duyệt và không huỷ, ngày bắt đầu thuộc kỳ. */
export function revenueContractWhere(
  user: AuthUser,
  period: Period,
): Prisma.ContractWhereInput {
  return {
    AND: [
      contractScope(user),
      {
        deletedAt: null,
        status: { notIn: NON_REVENUE_STATUSES },
        startDate: { gte: period.from, lte: period.to },
      },
    ],
  };
}
