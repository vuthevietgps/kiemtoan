import { Prisma } from '@prisma/client';
import { contractScope } from '../../../core/access-control/data-scope';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { NON_REVENUE_STATUSES, Period } from './period.util';

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

/** [đầu ngày `from`, hết ngày `to`) theo giờ Việt Nam, để so cột thời điểm (`approved_at`). */
export function vnMoments(period: Period): { gte: Date; lt: Date } {
  return {
    gte: new Date(period.from.getTime() - VN_OFFSET_MS),
    lt: new Date(period.to.getTime() + DAY_MS - VN_OFFSET_MS),
  };
}

/**
 * M4: HĐ tính giá trị trong kỳ = trong phạm vi, chưa xoá, không nháp / chờ duyệt / huỷ, **ngày duyệt**
 * thuộc kỳ (giờ VN).
 */
export function approvedContractWhere(
  user: AuthUser,
  period: Period,
): Prisma.ContractWhereInput {
  return {
    AND: [
      contractScope(user),
      {
        deletedAt: null,
        status: { notIn: NON_REVENUE_STATUSES },
        approvedAt: vnMoments(period),
      },
    ],
  };
}
