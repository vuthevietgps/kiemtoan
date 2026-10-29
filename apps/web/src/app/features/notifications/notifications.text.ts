/** Chuỗi giao diện chuông thông báo (06-D4). */
export const NOTIFICATIONS_TEXT = {
  ariaLabel: 'Thông báo',
  title: 'Thông báo',
  all: 'Tất cả',
  unread: 'Chưa đọc',
  markAll: 'Đánh dấu đã đọc tất cả',
  empty: 'Chưa có thông báo',
  emptyUnread: 'Không còn thông báo chưa đọc',
} as const;

/** Nhãn loại thông báo nhắc việc (06-C, I9/I13); thông báo sự kiện thường không gắn nhãn. */
export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  DUE_REMINDER: 'Nhắc hạn',
  OVERDUE: 'Quá hạn',
  ESCALATION: 'Leo thang',
  REVIEW_SLA: 'Quá SLA soát xét',
  REVIEW_SLA_ESCALATION: 'Leo thang SLA',
  DIGEST: 'Bản tin sáng',
};

export const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'blue',
  WARNING: 'orange',
  DANGER: 'red',
};
