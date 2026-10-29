/** Chuỗi giao diện Lịch báo cáo (06-D2; I4–I7). */
export const DEADLINES_TEXT = {
  title: 'Lịch báo cáo',
  subtitle: 'Hạn nộp báo cáo, tờ khai theo từng khách hàng và kỳ',
  search: 'Tìm theo tên hoặc mã số thuế khách hàng',
  allTypes: 'Tất cả loại báo cáo',
  allStatuses: 'Mọi trạng thái',
  allOwners: 'Tất cả người phụ trách',
  reset: 'Xoá lọc',
  cardNotDue: 'Chưa đến hạn',
  cardPreparing: 'Đang chuẩn bị',
  cardOverdue: 'Trễ hạn',
  cardFiled: 'Đã nộp trong tháng',
  // Bảng
  customer: 'Khách hàng',
  type: 'Loại báo cáo',
  period: 'Kỳ',
  dueDate: 'Hạn nộp',
  originalDue: 'Hạn ban đầu',
  status: 'Trạng thái',
  owner: 'Phụ trách',
  tasks: 'Việc gắn',
  empty: 'Không có báo cáo nào',
  filedLate: 'Nộp trễ',
  dueChanged: 'Hạn đã đổi theo lịch',
  // Ngăn chi tiết
  detail: 'Chi tiết báo cáo',
  legalBasis: 'Căn cứ',
  version: 'Quy tắc phiên bản',
  filedAt: 'Ngày nộp',
  receipt: 'Biên nhận',
  noTasks: 'Chưa có việc gắn — nhắc gửi cho người phụ trách khách hàng',
  history: 'Lịch sử',
  prepare: 'Đang chuẩn bị',
  file: 'Đánh dấu đã nộp',
  notApplicable: 'Không áp dụng',
  reopen: 'Mở lại',
  openCustomer: 'Mở khách hàng',
  receiptFile: 'File biên nhận (bắt buộc)',
  chooseFile: 'Chọn file',
  noFile: 'Chưa chọn file',
  note: 'Ghi chú',
  reason: 'Lý do (5–500 ký tự)',
  confirm: 'Xác nhận',
  cancel: 'Huỷ',
  done: 'Đã cập nhật lịch báo cáo',
  futureDate: 'Ngày nộp không được sau hôm nay',
  // Tab chi tiết KH
  settingsTitle: 'Loại báo cáo áp dụng cho khách hàng',
  settingsHint:
    'Hệ thống tự sinh lịch báo cáo theo dịch vụ trong hợp đồng; tắt riêng cho khách hàng cần lý do (ví dụ khách tự nộp).',
  byService: 'Theo dịch vụ HĐ',
  notByService: 'HĐ không có dịch vụ gắn loại này',
  enabled: 'Đang áp dụng',
  disabled: 'Đã tắt',
  turnOff: 'Tắt cho KH',
  turnOn: 'Bật lại',
  noTypes: 'Chưa có loại báo cáo nào được xác nhận',
  synced: (created: number, retired: number) =>
    `Đã đồng bộ lịch báo cáo: thêm ${created}, chuyển Không áp dụng ${retired}`,
} as const;

export type ObligationStatus = 'NOT_DUE' | 'PREPARING' | 'FILED' | 'NOT_APPLICABLE';
/** Trạng thái hiển thị: thêm OVERDUE = Trễ hạn (chưa nộp mà quá hạn — I7). */
export type ObligationDisplayStatus = ObligationStatus | 'OVERDUE';

export const OBLIGATION_STATUS_LABELS: Record<ObligationDisplayStatus, string> = {
  NOT_DUE: 'Chưa đến hạn',
  PREPARING: 'Đang chuẩn bị',
  OVERDUE: 'Trễ hạn',
  FILED: 'Đã nộp',
  NOT_APPLICABLE: 'Không áp dụng',
};

export const OBLIGATION_STATUS_COLORS: Record<ObligationDisplayStatus, string> = {
  NOT_DUE: 'default',
  PREPARING: 'processing',
  OVERDUE: 'red',
  FILED: 'green',
  NOT_APPLICABLE: 'default',
};

export const OBLIGATION_FILTERS: ObligationDisplayStatus[] = [
  'NOT_DUE',
  'PREPARING',
  'OVERDUE',
  'FILED',
  'NOT_APPLICABLE',
];
