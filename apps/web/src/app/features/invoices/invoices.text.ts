/** Loại hoá đơn (08 K6). */
export type InvoiceKind = 'ORIGINAL' | 'ADJUSTMENT' | 'REPLACEMENT';

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  ORIGINAL: 'Hoá đơn gốc',
  ADJUSTMENT: 'Điều chỉnh',
  REPLACEMENT: 'Thay thế',
};

/** Biểu mẫu ghi nhận hoá đơn đã xuất trên cổng EasyInvoice (08 K5, K6). */
export type RecordMode = 'issue' | 'adjust' | 'replace';

/** Chuỗi giao diện Đối chiếu thu – xuất (08-D, K8). */
export const RECONCILIATION_TEXT = {
  tab: 'Đối chiếu thu – xuất',
  search: 'Mã HĐ hoặc khách hàng',
  asOf: 'Đến ngày (mặc định hôm nay)',
  mismatchOnly: 'Chỉ HĐ chênh lệch',
  export: 'Xuất Excel',
  contract: 'Hợp đồng',
  customer: 'Khách hàng',
  paid: 'Đã thu (đã duyệt)',
  invoiced: 'Đã xuất hoá đơn',
  requested: 'Đang chờ xuất',
  paidNotInvoiced: 'Đã thu chưa xuất',
  invoicedNotPaid: 'Đã xuất chưa thu',
  empty: 'Không có hợp đồng nào',
  totalRow: (count: number) => `Tổng cộng (${count} hợp đồng)`,
} as const;

/** Chuỗi giao diện Hoá đơn (08). */
export const INVOICES_TEXT = {
  title: 'Hoá đơn',
  subtitle: 'Sổ hoá đơn công ty xuất cho khách hàng — xuất trên EasyInvoice rồi ghi nhận tại đây',
  tabQueue: 'Chờ xuất',
  tabLedger: 'Sổ hoá đơn',
  search: 'Số, ký hiệu, mã HĐ, khách hàng, người mua',
  allStatuses: 'Mọi trạng thái',
  allKinds: 'Mọi loại',
  find: 'Tìm',
  reset: 'Xoá lọc',
  empty: 'Không có hoá đơn nào',
  // Bảng
  identity: 'Mẫu số / Ký hiệu / Số',
  issueDate: 'Ngày lập',
  contract: 'Hợp đồng',
  buyer: 'Người mua',
  subtotal: 'Trước VAT',
  total: 'Tổng tiền',
  status: 'Trạng thái',
  kind: 'Loại',
  installments: 'Đợt',
  requestedBy: 'Người đề nghị',
  // Ngăn chi tiết
  detail: 'Hoá đơn',
  taxCode: 'Mã số thuế',
  address: 'Địa chỉ',
  email: 'Email nhận hoá đơn',
  vat: 'VAT',
  note: 'Ghi chú',
  reason: 'Lý do',
  lookupCode: 'Mã tra cứu',
  taxAuthorityCode: 'Mã CQT',
  issuedBy: 'Người ghi nhận',
  files: 'File hoá đơn',
  noFiles: 'Chưa có file',
  related: 'Hoá đơn liên quan',
  original: 'Hoá đơn gốc',
  history: 'Lịch sử',
  migrated: 'Hoá đơn ghi trước khi có sổ hoá đơn — dữ liệu chuyển đổi, không có file',
  notIssued: 'Chưa xuất',
  // Thao tác
  record: 'Ghi nhận đã xuất',
  editBuyer: 'Sửa người mua',
  cancel: 'Huỷ đề nghị',
  adjust: 'Điều chỉnh',
  replace: 'Thay thế',
  cancelReason: 'Lý do huỷ (5–500 ký tự)',
  confirm: 'Xác nhận',
  close: 'Đóng',
  done: 'Đã cập nhật hoá đơn',
  // Biểu mẫu ghi nhận
  recordTitle: {
    issue: 'Ghi nhận hoá đơn đã xuất',
    adjust: 'Ghi nhận hoá đơn điều chỉnh',
    replace: 'Ghi nhận hoá đơn thay thế',
  } as Record<RecordMode, string>,
  templateCode: 'Ký hiệu mẫu số',
  symbol: 'Ký hiệu',
  number: 'Số hoá đơn',
  pdf: 'File PDF hoá đơn (bắt buộc)',
  xml: 'File XML (nếu có)',
  chooseFile: 'Chọn file',
  noFile: 'Chưa chọn file',
  direction: 'Điều chỉnh',
  increase: 'Tăng',
  decrease: 'Giảm',
  adjustAmount: 'Số tiền điều chỉnh (trước VAT)',
  replaceAmount: 'Giá trị hoá đơn thay thế (trước VAT)',
  save: 'Lưu',
  required: 'Bắt buộc',
  // Đề nghị
  request: 'Đề nghị xuất hoá đơn',
  byInstallments: 'Theo đợt thanh toán',
  byValue: 'Theo giá trị',
  pickInstallments: 'Chọn đợt',
  noInstallments: 'Không còn đợt chưa có hoá đơn',
  remaining: 'Phần chưa xuất (trước VAT)',
  value: 'Giá trị trước VAT',
  vatNote: 'VAT tính theo thuế suất của hợp đồng',
  send: 'Gửi đề nghị',
  sent: 'Đã gửi đề nghị xuất hoá đơn',
} as const;
