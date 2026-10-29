/** Chuỗi giao diện trang Lịch & Deadline (06-D, I14). */
export const CALENDAR_TEXT = {
  title: 'Lịch & Deadline',
  subtitle: 'Hạn pháp lý của khách hàng và hạn công việc nội bộ',
  allCustomers: 'Tất cả khách hàng',
  allUsers: 'Tất cả nhân viên',
  allTypes: 'Tất cả loại báo cáo',
  allKinds: 'Pháp lý và nội bộ',
  allStatuses: 'Mọi trạng thái',
  reset: 'Xoá lọc',
  unconfirmedYear: (years: string) =>
    `Lịch năm ${years} chưa xác nhận — ngày làm việc đang tính thứ 2 đến thứ 6.`,
  truncated: 'Có quá nhiều mục trong khoảng này; hãy lọc thêm để xem đủ.',
  legendStatutory: 'Hạn pháp lý',
  legendInternal: 'Việc nội bộ',
  legendOverdue: 'Quá hạn',
  legendNear: 'Đến hạn hôm nay / ≤ 1 ngày',
  legendPriority: 'Cần ưu tiên',
  legendSoon: 'Sắp đến hạn',
  legendDone: 'Đã xong / đã nộp',
  legendDayOff: 'Ngày nghỉ',
  today: 'Hôm nay',
  month: 'Tháng',
  week: 'Tuần',
  list: 'Danh sách',
  noEvents: 'Không có hạn nào trong khoảng này',
  // Ngăn chi tiết
  statutory: 'Hạn pháp lý',
  internal: 'Việc nội bộ',
  statutoryTask: 'Việc gắn hạn pháp lý',
  customer: 'Khách hàng',
  period: 'Kỳ',
  dueDate: 'Hạn',
  status: 'Trạng thái',
  assignee: 'Người làm',
  owner: 'Phụ trách khách hàng',
  linkedTasks: 'Việc gắn',
  noLinkedTasks: 'Chưa có việc gắn',
  filedLate: 'Nộp trễ',
  openTask: 'Mở việc',
  openCustomer: 'Mở khách hàng',
  openObligation: 'Mở lịch báo cáo',
  close: 'Đóng',
  none: '—',
} as const;

export type CalendarKindFilter = 'STATUTORY' | 'INTERNAL';
export type CalendarStatusFilter = 'OPEN' | 'OVERDUE' | 'DONE';

export const KIND_LABELS: Record<CalendarKindFilter, string> = {
  STATUTORY: 'Chỉ hạn pháp lý',
  INTERNAL: 'Chỉ việc nội bộ',
};

export const STATUS_FILTER_LABELS: Record<CalendarStatusFilter, string> = {
  OPEN: 'Chưa xong',
  OVERDUE: 'Quá hạn / trễ hạn',
  DONE: 'Đã xong / đã nộp',
};

/** Trạng thái lịch báo cáo (I7); "OVERDUE" = chưa nộp mà quá hạn. */
export const OBLIGATION_STATUS_LABELS: Record<string, string> = {
  NOT_DUE: 'Chưa đến hạn',
  PREPARING: 'Đang chuẩn bị',
  FILED: 'Đã nộp',
  NOT_APPLICABLE: 'Không áp dụng',
  OVERDUE: 'Trễ hạn',
};
