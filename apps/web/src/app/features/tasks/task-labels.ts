/** Nhãn tiếng Việt cho công việc — 8 trạng thái theo đặc tả 05 (PL1 III.3). */
export type TaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_CLIENT'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'ON_HOLD';

export const TASK_STATUSES: TaskStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'COMPLETED',
  'ON_HOLD',
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  WAITING_CLIENT: 'Chờ khách hàng',
  IN_REVIEW: 'Chờ kiểm tra',
  CHANGES_REQUESTED: 'Yêu cầu chỉnh sửa',
  APPROVED: 'Đã phê duyệt',
  COMPLETED: 'Hoàn thành',
  ON_HOLD: 'Tạm dừng',
};

/** Màu nz-tag theo trạng thái. */
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  NOT_STARTED: 'default',
  IN_PROGRESS: 'processing',
  WAITING_CLIENT: 'orange',
  IN_REVIEW: 'purple',
  CHANGES_REQUESTED: 'error',
  APPROVED: 'cyan',
  COMPLETED: 'success',
  ON_HOLD: 'warning',
};

/** Mức độ/ưu tiên (05 H10; nhãn theo bảng LTGroup — 04-F4). */
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Thấp',
  NORMAL: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Rất gấp',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: 'default',
  NORMAL: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
};

/** Hồ sơ yêu cầu của khách — 6 trạng thái (05-D, PL1 V). */
export type DocumentRequestStatus =
  'NOT_REQUESTED' | 'REQUESTED' | 'UPLOADED' | 'IN_REVIEW' | 'NEEDS_SUPPLEMENT' | 'ACCEPTED';

export const DOCUMENT_REQUEST_LABELS: Record<
  DocumentRequestStatus,
  { label: string; color: string }
> = {
  NOT_REQUESTED: { label: 'Chưa yêu cầu', color: 'default' },
  REQUESTED: { label: 'Đã yêu cầu', color: 'blue' },
  UPLOADED: { label: 'Khách đã tải lên', color: 'cyan' },
  IN_REVIEW: { label: 'Đang kiểm tra', color: 'purple' },
  NEEDS_SUPPLEMENT: { label: 'Cần bổ sung', color: 'orange' },
  ACCEPTED: { label: 'Đã chấp nhận', color: 'green' },
};

export const DUE_CHANGE_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ duyệt', color: 'orange' },
  APPROVED: { label: 'Đã duyệt', color: 'green' },
  REJECTED: { label: 'Từ chối', color: 'red' },
};

/** Thao tác của người làm (API /tasks/:id/<action>). */
export type TaskAction = 'start' | 'submit' | 'complete' | 'deliver';

export interface QuickAction {
  action: TaskAction;
  label: string;
}

/**
 * Nút nhanh cho người làm trên bảng/kanban. Giao nộp và hoàn thành cần ghi kết quả thì mở chi tiết
 * việc thay vì nút nhanh.
 */
export function quickAction(task: {
  status: TaskStatus;
  reviewLevels: number;
  requiresDelivery: boolean;
  waitingFor?: string[];
}): QuickAction | null {
  switch (task.status) {
    case 'NOT_STARTED':
      // H6: bước trước chưa xong thì chưa bắt đầu được.
      return task.waitingFor?.length ? null : { action: 'start', label: 'Bắt đầu' };
    case 'IN_PROGRESS':
      if (task.reviewLevels > 0) return { action: 'submit', label: 'Gửi kiểm tra' };
      return task.requiresDelivery ? null : { action: 'complete', label: 'Hoàn thành' };
    case 'CHANGES_REQUESTED':
      return { action: 'submit', label: 'Gửi lại' };
    default:
      return null;
  }
}

/** Nhãn H6 cho việc có bước trước cùng kỳ chưa xong. */
export const NOT_READY_LABEL = 'Chưa đủ điều kiện';

export function waitingText(waitingFor: string[]): string {
  return `Chờ bước trước: ${waitingFor.join(', ')}`;
}

export type DueFilter = 'overdue' | 'today' | 'week' | 'month';

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  overdue: 'Quá hạn',
  today: 'Hạn hôm nay',
  week: 'Hạn trong 7 ngày',
  month: 'Hạn trong tháng',
};

/** Bộ lọc trạng thái, thêm OPEN = chưa Hoàn thành. */
export type StatusFilter = TaskStatus | 'OPEN';

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  OPEN: 'Còn phải làm',
  ...TASK_STATUS_LABELS,
};

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo công việc',
  UPDATE: 'Cập nhật thông tin',
  START: 'Bắt đầu thực hiện',
  SUBMIT: 'Gửi kiểm tra',
  COMPLETE: 'Hoàn thành',
  ACCEPT: 'Chấp nhận',
  RETURN: 'Trả lại, yêu cầu chỉnh sửa',
  DELIVER: 'Xác nhận giao nộp',
  EVIDENCE: 'Tải lên bằng chứng',
  WAIT_CLIENT: 'Chuyển Chờ khách',
  RESUME: 'Tiếp tục sau chờ khách',
  HOLD: 'Tạm dừng',
  UNHOLD: 'Tiếp tục sau tạm dừng',
  REOPEN: 'Mở lại',
  DUE_CHANGE_REQUEST: 'Đề nghị gia hạn',
  DUE_CHANGE_APPROVE: 'Duyệt gia hạn',
  DUE_CHANGE_REJECT: 'Từ chối gia hạn',
  DUE_CHANGE_DOCUMENTED: 'Gia hạn theo văn bản',
  WAIT_CONFIRM: 'Xác nhận khoảng chờ khách',
  // Nhật ký trước 05 (dữ liệu chuyển đổi).
  STATUS: 'Chuyển trạng thái (trước chuyển đổi)',
  APPROVE: 'Duyệt công việc (trước chuyển đổi)',
};

export const EVIDENCE_REQUIRED_MESSAGE =
  'Vui lòng tải lên file bằng chứng trước khi gửi kiểm tra hoặc hoàn thành';

/** Mức gấp tự động theo thời gian còn lại (06, I11; bảng mốc PL1 IV.2). */
export type Urgency = 'OVERDUE' | 'TODAY' | 'NEAR' | 'PRIORITY' | 'DUE_SOON' | 'NORMAL';

export const URGENCY_LABELS: Record<Urgency, string> = {
  OVERDUE: 'Quá hạn',
  TODAY: 'Đến hạn hôm nay',
  NEAR: 'Gần đến hạn',
  PRIORITY: 'Cần ưu tiên',
  DUE_SOON: 'Sắp đến hạn',
  NORMAL: 'Bình thường',
};

export const URGENCY_COLORS: Record<Urgency, string> = {
  OVERDUE: 'red',
  TODAY: 'volcano',
  NEAR: 'orange',
  PRIORITY: 'gold',
  DUE_SOON: 'blue',
  NORMAL: 'default',
};
