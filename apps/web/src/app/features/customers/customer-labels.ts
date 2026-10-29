/** Nhãn tiếng Việt và màu tag cho các enum của khách hàng, tài liệu, tài khoản công ty. */

export type CustomerStatus = 'PROSPECT' | 'ACTIVE' | 'PAUSED' | 'STOPPED';
export type TaxPeriod = 'MONTHLY' | 'QUARTERLY';
/** Trường thuế–kế toán dùng sinh lịch báo cáo (06, I5). */
export type VatMethod = 'DEDUCTION' | 'DIRECT' | 'NONE';
export type PitPeriod = 'MONTHLY' | 'QUARTERLY' | 'NONE';
export type AccountingRegime = 'TT200' | 'TT133' | 'OTHER';
export type DocumentCategory =
  | 'LEGAL'
  | 'CONTRACT'
  | 'SERVICE'
  | 'EVIDENCE'
  | 'PAYMENT'
  | 'OTHER';
export type CredentialType =
  | 'TAX_PORTAL'
  | 'SOCIAL_INSURANCE'
  | 'E_INVOICE'
  | 'EMAIL'
  | 'DIGITAL_SIGNATURE'
  | 'OTHER';
export type CredentialStatus = 'ACTIVE' | 'ERROR' | 'NEED_CHANGE';

export interface Option<T extends string> {
  value: T;
  label: string;
}

function toOptions<T extends string>(labels: Record<T, string>): Option<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  PROSPECT: 'Tiềm năng',
  ACTIVE: 'Đang phục vụ',
  PAUSED: 'Tạm ngưng',
  STOPPED: 'Đã ngừng',
};

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, string> = {
  PROSPECT: 'blue',
  ACTIVE: 'green',
  PAUSED: 'orange',
  STOPPED: 'default',
};

export const TAX_PERIOD_LABELS: Record<TaxPeriod, string> = {
  MONTHLY: 'Theo tháng',
  QUARTERLY: 'Theo quý',
};

export const VAT_METHOD_LABELS: Record<VatMethod, string> = {
  DEDUCTION: 'Khấu trừ',
  DIRECT: 'Trực tiếp',
  NONE: 'Không kê khai GTGT',
};

export const PIT_PERIOD_LABELS: Record<PitPeriod, string> = {
  MONTHLY: 'Theo tháng',
  QUARTERLY: 'Theo quý',
  NONE: 'Không khấu trừ',
};

export const ACCOUNTING_REGIME_LABELS: Record<AccountingRegime, string> = {
  TT200: 'Thông tư 200',
  TT133: 'Thông tư 133',
  OTHER: 'Khác',
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LEGAL: 'Hồ sơ pháp lý',
  CONTRACT: 'Hợp đồng',
  SERVICE: 'Tài liệu dịch vụ',
  EVIDENCE: 'Bằng chứng công việc',
  PAYMENT: 'Chứng từ thu tiền',
  OTHER: 'Khác',
};

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  TAX_PORTAL: 'Cổng thuế điện tử',
  SOCIAL_INSURANCE: 'Bảo hiểm xã hội',
  E_INVOICE: 'Hoá đơn điện tử',
  EMAIL: 'Email',
  DIGITAL_SIGNATURE: 'Chữ ký số',
  OTHER: 'Khác',
};

export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  ACTIVE: 'Đang dùng được',
  ERROR: 'Lỗi đăng nhập',
  NEED_CHANGE: 'Cần đổi mật khẩu',
};

export const CREDENTIAL_STATUS_COLORS: Record<CredentialStatus, string> = {
  ACTIVE: 'green',
  ERROR: 'red',
  NEED_CHANGE: 'orange',
};

/** Nhãn trạng thái hợp đồng (chỉ để hiển thị ở tab Hợp đồng của khách hàng). */
export const CONTRACT_STATUS_LABELS: Partial<Record<string, string>> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  NOT_STARTED: 'Chưa thực hiện',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Đã hoàn thành',
  LIQUIDATED: 'Thanh lý',
  CANCELLED: 'Huỷ',
};

export const CUSTOMER_STATUS_OPTIONS = toOptions(CUSTOMER_STATUS_LABELS);
export const TAX_PERIOD_OPTIONS = toOptions(TAX_PERIOD_LABELS);
export const VAT_METHOD_OPTIONS = toOptions(VAT_METHOD_LABELS);
export const PIT_PERIOD_OPTIONS = toOptions(PIT_PERIOD_LABELS);
export const ACCOUNTING_REGIME_OPTIONS = toOptions(ACCOUNTING_REGIME_LABELS);
export const FISCAL_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Tháng ${i + 1}`,
}));
export const DOCUMENT_CATEGORY_OPTIONS = toOptions(DOCUMENT_CATEGORY_LABELS);
export const CREDENTIAL_TYPE_OPTIONS = toOptions(CREDENTIAL_TYPE_LABELS);
export const CREDENTIAL_STATUS_OPTIONS = toOptions(CREDENTIAL_STATUS_LABELS);
