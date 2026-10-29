/**
 * Sự kiện giữa các module (docs/quy-tac-code.md, mục 5): module phát không import module nghe.
 * Phát bằng EventEmitter2.emit(TÊN, payload); nghe bằng @OnEvent(TÊN).
 */
export const CONTRACT_APPROVED = 'contract.approved';
export interface ContractApprovedEvent {
  contractId: string;
  approvedById: string;
}

/** Yêu cầu sinh (lại) việc cho dòng dịch vụ chưa sinh/lỗi của HĐ đã duyệt (đặc tả 04-A). */
export const CONTRACT_TASKS_REQUESTED = 'contract.tasks-requested';

/** HĐ bị huỷ (đặc tả 04-D): 05 chuyển việc chưa bắt đầu sang huỷ; 04 không tự xoá việc. */
export const CONTRACT_CANCELLED = 'contract.cancelled';
export interface ContractCancelledEvent {
  contractId: string;
  cancelledById: string;
  reason: string | null;
}

export const TASK_ASSIGNED = 'task.assigned';
export interface TaskAssignedEvent {
  taskId: string;
  assigneeId: string;
  title: string;
}

/** Thông báo trong ứng dụng cho nhiều người về một việc (05-D: gửi kiểm tra, trả lại, chờ khách…). */
export const TASK_NOTIFY = 'task.notify';
export interface TaskNotifyEvent {
  userIds: (string | null | undefined)[];
  title: string;
  taskId: string;
  /** Không báo cho chính người thao tác. */
  actorId?: string | null;
}

/** 02 → 06: trường thuế–kế toán hoặc trạng thái KH đổi, đồng bộ lịch báo cáo (I5). */
export const CUSTOMER_TAX_PROFILE_CHANGED = 'customer.tax-profile-changed';
export interface CustomerTaxProfileChangedEvent {
  customerId: string;
  actorId: string;
}

/** 05 → 06: việc gắn nghĩa vụ đổi trạng thái (I6: bắt đầu → Đang chuẩn bị, Hoàn thành → Đã nộp). */
export const TASK_OBLIGATION_PROGRESS = 'task.obligation-progress';
export interface TaskObligationProgressEvent {
  obligationId: string;
  taskId: string;
  status: string;
  actorId: string;
}

/** 06 → 05: hạn nghĩa vụ đổi theo lịch/quy tắc mới (I8); việc gắn chưa hoàn thành đổi hạn theo. */
export const OBLIGATION_DUES_CHANGED = 'obligation.dues-changed';
export interface ObligationDuesChangedEvent {
  changes: { obligationId: string; oldDue: Date; newDue: Date }[];
  actorId: string;
  reason: string;
}
