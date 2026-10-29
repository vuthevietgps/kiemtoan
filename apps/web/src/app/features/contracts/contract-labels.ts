/** Nhãn tiếng Việt cho hợp đồng, thanh toán, hoá đơn, dịch vụ — dùng chung cho các feature contracts/payments/invoices/service-catalog. */

export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'LIQUIDATED'
  | 'CANCELLED';

/** 07-D2: OVERDUE = chưa thu đủ và có đợt quá hạn. */
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
/** 08 K1: Chờ xuất → Đã xuất → Đã điều chỉnh / Bị thay thế; Huỷ đề nghị. */
export type InvoiceStatus = 'REQUESTED' | 'ISSUED' | 'ADJUSTED' | 'REPLACED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';
export type AgingBucket = '0-30' | '31-60' | '61-90' | '>90';

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  NOT_STARTED: 'Chưa thực hiện',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Đã hoàn thành',
  LIQUIDATED: 'Thanh lý',
  CANCELLED: 'Huỷ',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'gold',
  NOT_STARTED: 'purple',
  IN_PROGRESS: 'blue',
  COMPLETED: 'green',
  LIQUIDATED: 'cyan',
  CANCELLED: 'red',
};

export const CONTRACT_STATUS_OPTIONS = (
  Object.keys(CONTRACT_STATUS_LABELS) as ContractStatus[]
).map((value) => ({ value, label: CONTRACT_STATUS_LABELS[value] }));

/** Chuyển trạng thái thủ công được phép (khớp backend contracts.constants.ts). */
export const CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ['CANCELLED'],
  PENDING_APPROVAL: ['CANCELLED'],
  NOT_STARTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['LIQUIDATED', 'IN_PROGRESS'],
  LIQUIDATED: [],
  CANCELLED: [],
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'Thanh toán một phần',
  PAID: 'Đã thanh toán đủ',
  OVERDUE: 'Còn nợ quá hạn',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  UNPAID: 'default',
  PARTIAL: 'orange',
  PAID: 'green',
  OVERDUE: 'red',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  REQUESTED: 'Chờ xuất',
  ISSUED: 'Đã xuất',
  ADJUSTED: 'Đã điều chỉnh',
  REPLACED: 'Bị thay thế',
  CANCELLED: 'Huỷ đề nghị',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  REQUESTED: 'gold',
  ISSUED: 'green',
  ADJUSTED: 'cyan',
  REPLACED: 'default',
  CANCELLED: 'red',
};

export const INVOICE_STATUS_OPTIONS = (Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map(
  (value) => ({ value, label: INVOICE_STATUS_LABELS[value] }),
);

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: 'Hằng tháng',
  QUARTERLY: 'Hằng quý',
  YEARLY: 'Hằng năm',
  ONE_TIME: 'Một lần',
};

export const BILLING_CYCLE_OPTIONS = (Object.keys(BILLING_CYCLE_LABELS) as BillingCycle[]).map(
  (value) => ({ value, label: BILLING_CYCLE_LABELS[value] }),
);

export const AGING_LABELS: Record<AgingBucket, string> = {
  '0-30': 'Quá hạn 0–30 ngày',
  '31-60': 'Quá hạn 31–60 ngày',
  '61-90': 'Quá hạn 61–90 ngày',
  '>90': 'Quá hạn trên 90 ngày',
};

export const AGING_COLORS: Record<AgingBucket, string> = {
  '0-30': 'gold',
  '31-60': 'orange',
  '61-90': 'volcano',
  '>90': 'red',
};
