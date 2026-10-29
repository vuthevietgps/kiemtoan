import { ContractStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

/** Luật vòng đời phiếu thu (đặc tả 07, J1–J8) — hàm thuần. */

const { DRAFT, PENDING, RETURNED, APPROVED, CANCELLED } = PaymentStatus;

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  RETURNED: 'Trả lại',
  APPROVED: 'Đã duyệt',
  CANCELLED: 'Đã huỷ',
};

/** Người lập còn sửa được (số tiền, ngày, đợt, chứng từ). */
export const EDITABLE: PaymentStatus[] = [DRAFT, RETURNED];

/** Phiếu đang mở — tính vào giới hạn "không thu vượt" (J6) cùng phiếu đã duyệt. */
export const OPEN_STATUSES: PaymentStatus[] = [
  DRAFT,
  PENDING,
  RETURNED,
  APPROVED,
];

export type PaymentAction =
  'submit' | 'withdraw' | 'approve' | 'return' | 'cancel';

/** Trạng thái được phép trước mỗi thao tác và trạng thái sau. */
export const TRANSITIONS: Record<
  PaymentAction,
  { from: PaymentStatus[]; to: PaymentStatus }
> = {
  submit: { from: [DRAFT, RETURNED], to: PENDING },
  withdraw: { from: [DRAFT, PENDING, RETURNED], to: CANCELLED },
  approve: { from: [PENDING], to: APPROVED },
  return: { from: [PENDING], to: RETURNED },
  cancel: { from: [APPROVED], to: CANCELLED },
};

/** J7: chỉ thu cho HĐ đã duyệt (Chưa thực hiện, Đang thực hiện, Đã hoàn thành, Thanh lý). */
export const BILLABLE_CONTRACT: ContractStatus[] = [
  ContractStatus.NOT_STARTED,
  ContractStatus.IN_PROGRESS,
  ContractStatus.COMPLETED,
  ContractStatus.LIQUIDATED,
];

/** J8: điều kiện chứng từ khi gửi duyệt; trả lỗi tiếng Việt hoặc null. */
export function submitError(payment: {
  method: PaymentMethod;
  documentNumber: string | null;
  documentCount: number;
}): string | null {
  if (
    payment.method === PaymentMethod.BANK_TRANSFER &&
    payment.documentCount < 1
  )
    return 'Phiếu chuyển khoản cần đính kèm ít nhất một file chứng từ (sao kê, uỷ nhiệm chi) trước khi gửi duyệt';
  if (payment.method === PaymentMethod.CASH && !payment.documentNumber?.trim())
    return 'Phiếu tiền mặt cần số phiếu thu giấy hoặc số biên nhận trước khi gửi duyệt';
  return null;
}

/** J1: người lập không tự duyệt / trả lại phiếu của mình (như R3 ở 05). */
export function isSelfReview(
  payment: { receivedById: string },
  userId: string,
) {
  return payment.receivedById === userId;
}
