import { TaskGenerationStatus } from './data-access/contracts.api';

/** Chuỗi giao diện thêm từ 04-A (duyệt an toàn, trả lại, trạng thái sinh việc). */
export const CONTRACTS_TEXT = {
  approve: 'Duyệt',
  returnToDraft: 'Trả lại',
  returnTitle: 'Trả lại hợp đồng',
  returnReason: 'Lý do trả lại',
  returnHint: 'Hợp đồng về trạng thái Nháp để người lập sửa và gửi duyệt lại.',
  returnError: 'Lý do từ 5 đến 500 ký tự',
  returned: 'Đã trả lại hợp đồng',
  returnedAlert: 'Hợp đồng bị trả lại',
  confirm: 'Đồng ý',
  cancel: 'Huỷ',
  confirmApprove:
    'Duyệt hợp đồng này? Hệ thống sẽ sinh công việc cho các dòng dịch vụ đã xác nhận kế hoạch thực hiện.',
  taskGeneration: 'Sinh việc',
  regenerate: 'Sinh lại việc',
  regenerated: 'Đã chạy sinh việc cho các dòng chưa sinh',
  regenerateHint:
    'Có dòng dịch vụ chưa sinh việc. Kiểm tra quy trình ở Dịch vụ & quy trình rồi bấm Sinh lại việc.',
} as const;

/** Chuỗi giao diện kế hoạch thực hiện (04-B). */
export const PLAN_TEXT = {
  title: 'Kế hoạch thực hiện',
  hint: 'Việc chỉ được sinh khi hợp đồng đã duyệt và kế hoạch của dòng dịch vụ đã xác nhận.',
  noPlan: 'Chưa lập kế hoạch',
  create: 'Lập kế hoạch',
  rebuild: 'Lập lại từ quy trình',
  workflow: 'Quy trình',
  save: 'Lưu thay đổi',
  confirm: 'Xác nhận kế hoạch',
  reopen: 'Mở lại',
  confirmed: 'Đã xác nhận',
  draft: 'Đang rà soát',
  confirmQuestion:
    'Xác nhận kế hoạch này? Kế hoạch sẽ bị khoá; nếu hợp đồng đã duyệt, hệ thống sinh việc ngay.',
  stepNo: '#',
  phase: 'Giai đoạn',
  step: 'Công việc',
  duration: 'Ngày làm',
  offset: 'Ngày sau kỳ',
  start: 'Bắt đầu',
  due: 'Hạn',
  assignee: 'Người thực hiện',
  skip: 'Bỏ qua',
  optional: 'Tuỳ chọn',
  requirements: 'Hồ sơ cần thu',
  ifAny: 'nếu có',
  saved: 'Đã lưu kế hoạch',
  confirmedMsg: 'Đã xác nhận kế hoạch',
  reopened: 'Đã mở lại kế hoạch',
  created: 'Đã lập kế hoạch',
  unsaved: 'Có thay đổi chưa lưu',
  confirmOk: 'Đồng ý',
  cancel: 'Huỷ',
  byDefault: 'Theo người phụ trách',
  reviewer: 'Người kiểm tra',
  noReviewer: 'Chưa chọn',
  startDate: 'Ngày bắt đầu',
  period: 'Kỳ',
  note: 'Ghi chú',
  periodHint: 'YYYY, YYYY-MM hoặc YYYY-Qn',
  previewHint: 'Ngày tô xanh là lịch dự kiến sau khi lưu.',
  discard: 'Bỏ thay đổi',
  noPhase: 'Khác',
  periods: 'Tiến độ theo kỳ',
} as const;

export const TASK_GENERATION_LABELS: Record<
  TaskGenerationStatus,
  { label: string; color: string }
> = {
  PENDING: { label: 'Chưa sinh', color: 'default' },
  GENERATING: { label: 'Đang sinh', color: 'processing' },
  DONE: { label: 'Đã sinh', color: 'green' },
  SKIPPED: { label: 'Bỏ qua', color: 'orange' },
  FAILED: { label: 'Lỗi', color: 'red' },
};
