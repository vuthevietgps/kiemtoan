/** Trạng thái phiếu thu (07-C, J1–J5). Khác `PaymentStatus` của HĐ (Chưa thu / Thu một phần / Đã thu). */
export type PaymentState = 'DRAFT' | 'PENDING' | 'RETURNED' | 'APPROVED' | 'CANCELLED';

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  RETURNED: 'Trả lại',
  APPROVED: 'Đã duyệt',
  CANCELLED: 'Đã huỷ',
};

export const PAYMENT_STATE_COLORS: Record<PaymentState, string> = {
  DRAFT: 'default',
  PENDING: 'gold',
  RETURNED: 'orange',
  APPROVED: 'green',
  CANCELLED: 'red',
};

export const PAYMENT_STATE_OPTIONS = (Object.keys(PAYMENT_STATE_LABELS) as PaymentState[]).map(
  (value) => ({ value, label: PAYMENT_STATE_LABELS[value] }),
);

/** Người lập còn sửa / đính kèm / gửi duyệt được. */
export const EDITABLE_STATES: PaymentState[] = ['DRAFT', 'RETURNED'];

/** Nhóm tuổi nợ theo J12 (đợt quá hạn tính từ ngày 1). */
export const RECEIVABLE_AGING_LABELS = {
  notDue: 'Chưa đến hạn',
  '0-30': '1–30 ngày',
  '31-60': '31–60 ngày',
  '61-90': '61–90 ngày',
  '>90': 'Trên 90 ngày',
} as const;

export const RECEIVABLE_AGING_COLORS = {
  notDue: '#1677ff',
  '0-30': '#faad14',
  '31-60': '#fa8c16',
  '61-90': '#fa541c',
  '>90': '#cf1322',
} as const;

/** Chuỗi giao diện Công nợ, Sắp đến hạn / Quá hạn (07-D1). */
export const RECEIVABLES_TEXT = {
  tabDue: 'Sắp đến hạn / Quá hạn',
  search: 'Mã HĐ hoặc khách hàng',
  export: 'Xuất Excel',
  cardRemaining: 'Phải thu',
  cardOverdue: 'Quá hạn',
  cardUpcoming: 'Đến hạn 7 ngày tới',
  cardPending: 'Đang chờ duyệt',
  agingTitle: 'Tuổi nợ',
  customer: 'Khách hàng',
  contracts: 'Hợp đồng',
  contract: 'Hợp đồng',
  owner: 'Phụ trách',
  total: 'Tổng thanh toán',
  paid: 'Đã thu',
  remaining: 'Còn phải thu',
  overdue: 'Quá hạn',
  pending: 'Chờ duyệt',
  installment: 'Đợt',
  dueDate: 'Hạn',
  amount: 'Số tiền đợt',
  status: 'Tình trạng',
  dueToday: 'Đến hạn hôm nay',
  awaitingReport: (days: number) => `Chờ phát hành BCKT (+${days} ngày)`,
  expected: 'dự kiến ',
  dueIn: (days: number) => `Còn ${days} ngày`,
  overdueBy: (days: number) => `Quá hạn ${days} ngày`,
  notDueYet: 'Chưa đến hạn',
  empty: 'Không có công nợ',
  emptyDue: 'Không có đợt nào',
  totalRow: (count: number) => `Tổng cộng (${count} hợp đồng)`,
  overdueTab: 'Quá hạn',
  upcomingTab: 'Sắp đến hạn',
  within: 'Trong',
  daysUnit: 'ngày tới',
  dueSum: 'Tổng còn thiếu',
  collect: 'Lập phiếu',
  request: 'Đề nghị TT',
  pendingHint: 'Có phiếu chờ duyệt',
  noOwner: '—',
} as const;

/** Chuỗi giao diện Đề nghị thanh toán (07-D3, J9). */
export const PAYMENT_REQUEST_TEXT = {
  open: 'Đề nghị thanh toán',
  title: 'Đề nghị thanh toán',
  pick: 'Chọn đợt đề nghị',
  amount: 'Số tiền đề nghị',
  transfer: 'Nội dung chuyển khoản',
  account: 'Tài khoản nhận',
  qrAlt: 'Mã VietQR chuyển khoản',
  noBank: 'Chưa cấu hình tài khoản nhận tiền nên chưa tạo được mã VietQR',
  hint: 'File Word được lưu vào hồ sơ của hợp đồng (tab Hồ sơ) và tải về máy.',
  create: 'Tạo file Word',
  close: 'Đóng',
  done: 'Đã tạo đề nghị thanh toán',
} as const;

/** Chuỗi giao diện Thu tiền (07-C). */
export const PAYMENTS_TEXT = {
  title: 'Thu tiền & công nợ',
  subtitle: 'Lập phiếu thu từ chi tiết hợp đồng; chỉ phiếu Đã duyệt tính vào đã thu',
  tabList: 'Phiếu thu',
  tabPending: 'Chờ duyệt',
  tabReceivables: 'Công nợ',
  search: 'Mã phiếu, số chứng từ, mã HĐ, khách hàng',
  allStates: 'Mọi trạng thái',
  find: 'Tìm',
  reset: 'Xoá lọc',
  // Bảng
  code: 'Mã phiếu',
  paidDate: 'Ngày thu',
  contract: 'Hợp đồng',
  customer: 'Khách hàng',
  amount: 'Số tiền',
  method: 'Hình thức',
  state: 'Trạng thái',
  receivedBy: 'Người lập',
  empty: 'Không có phiếu thu nào',
  // Ngăn chi tiết
  detail: 'Phiếu thu',
  documentNumber: 'Số chứng từ',
  installment: 'Đợt',
  note: 'Ghi chú',
  noInstallment: 'Không chỉ định — trừ đợt hạn sớm nhất',
  allocations: 'Phân bổ vào đợt',
  documents: 'Chứng từ',
  noDocuments: 'Chưa có file chứng từ',
  attach: 'Đính kèm file',
  detach: 'Gỡ file',
  history: 'Lịch sử',
  migrated: 'Phiếu ghi nhận trước khi có duyệt thu — chuyển thành Đã duyệt khi nâng cấp (J15)',
  returnReason: 'Lý do trả lại',
  cancelReason: 'Lý do huỷ',
  approvedBy: 'Người duyệt',
  edit: 'Sửa',
  submit: 'Gửi duyệt',
  withdraw: 'Rút phiếu',
  withdrawConfirm: 'Rút phiếu này? Phiếu chuyển sang Đã huỷ.',
  approve: 'Duyệt',
  approveConfirm: 'Duyệt phiếu thu? Số tiền sẽ tính vào đã thu của hợp đồng.',
  return: 'Trả lại',
  cancel: 'Huỷ phiếu',
  reason: 'Lý do (5–500 ký tự)',
  confirm: 'Xác nhận',
  close: 'Đóng',
  selfReview: 'Bạn là người lập — người khác có quyền duyệt sẽ duyệt phiếu này',
  done: 'Đã cập nhật phiếu thu',
  // Form
  newPayment: 'Lập phiếu thu',
  editPayment: 'Sửa phiếu thu',
  remaining: 'Còn phải thu',
  pendingHint: 'đang chờ duyệt',
  documentNumberCash: 'Số phiếu thu giấy / biên nhận (bắt buộc khi gửi duyệt)',
  documentNumberTransfer: 'Mã giao dịch (nếu có)',
  fileTransfer: 'File chứng từ — sao kê, uỷ nhiệm chi (bắt buộc khi gửi duyệt)',
  fileCash: 'File chứng từ (tuỳ chọn)',
  chooseFile: 'Chọn file',
  saveDraft: 'Lưu nháp',
  saveSubmit: 'Lưu và gửi duyệt',
  saved: 'Đã lưu phiếu thu',
  savedDraftOnly: 'Đã lưu nháp nhưng chưa gửi duyệt',
  amountError: 'Số tiền phải lớn hơn 0',
  dateError: 'Chọn ngày thu (không sau hôm nay)',
} as const;
