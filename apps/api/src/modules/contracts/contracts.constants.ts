import { ContractStatus } from '@prisma/client';

/** Hợp đồng còn được sửa nội dung (dịch vụ, đợt thanh toán). */
export const EDITABLE_STATUSES: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.PENDING_APPROVAL,
];

/** Hợp đồng chưa duyệt hoặc đã huỷ: không thu tiền, không tính công nợ. */
export const NOT_BILLABLE_STATUSES: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.CANCELLED,
];

/** Chuyển trạng thái thủ công (POST /contracts/:id/status) được phép từ → đến. */
export const STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: [ContractStatus.CANCELLED],
  PENDING_APPROVAL: [ContractStatus.CANCELLED],
  NOT_STARTED: [ContractStatus.IN_PROGRESS, ContractStatus.CANCELLED],
  IN_PROGRESS: [ContractStatus.COMPLETED, ContractStatus.CANCELLED],
  COMPLETED: [ContractStatus.LIQUIDATED, ContractStatus.IN_PROGRESS],
  LIQUIDATED: [],
  CANCELLED: [],
};

export function canTransition(
  from: ContractStatus,
  to: ContractStatus,
): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Số ngày từ ngày bắt đầu đến hạn của đợt thanh toán mặc định. */
export const DEFAULT_INSTALLMENT_DAYS = 30;
