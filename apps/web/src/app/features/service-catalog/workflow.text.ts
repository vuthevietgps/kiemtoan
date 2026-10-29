import { ScheduleMode, WorkflowRole, WorkflowStatus } from './data-access/workflows.api';

export const WORKFLOW_TEXT = {
  title: 'Quy trình mẫu', subtitle: 'Các bước thực hiện từng dịch vụ, có phiên bản; hợp đồng sinh việc từ phiên bản đang hiệu lực',
  add: 'Thêm quy trình', service: 'Dịch vụ', allServices: 'Tất cả dịch vụ', search: 'Tìm theo mã hoặc tên', code: 'Mã', name: 'Tên quy trình',
  activeVersion: 'Đang hiệu lực', draft: 'Bản nháp', isDefault: 'Mặc định', noVersion: 'Chưa phát hành', open: 'Mở',
  createTitle: 'Thêm quy trình mẫu', cancel: 'Huỷ', confirm: 'Đồng ý', save: 'Lưu', create: 'Tạo', nameError: 'Tên quy trình từ 2 đến 200 ký tự',
  serviceError: 'Vui lòng chọn dịch vụ', back: 'Danh sách quy trình', version: 'Phiên bản', versions: 'Lịch sử phiên bản',
  scheduleMode: 'Cách lập lịch', note: 'Ghi chú phiên bản', steps: 'Các bước', addStep: 'Thêm bước', preview: 'Xem trước lịch',
  saveDraft: 'Lưu bản nháp', publish: 'Phát hành', confirmPublish: 'Phát hành phiên bản này? Phiên bản đang hiệu lực sẽ chuyển sang Ngừng.',
  newDraft: 'Tạo bản nháp từ phiên bản này', removeDraft: 'Xoá bản nháp', confirmRemove: 'Xoá bản nháp này?', setDefault: 'Đặt làm mặc định',
  readonlyHint: 'Phiên bản đã phát hành không sửa được. Tạo bản nháp mới để thay đổi.', unsaved: 'Có thay đổi chưa lưu',
  saved: 'Đã lưu bản nháp', published: 'Đã phát hành phiên bản', cloned: 'Đã tạo bản nháp mới', removed: 'Đã xoá bản nháp', defaultSet: 'Đã đặt làm quy trình mặc định',
  stepNo: '#', phase: 'Giai đoạn', stepName: 'Công việc', duration: 'Thời lượng (ngày làm việc)', dueOffset: 'Hạn (ngày sau cuối kỳ)',
  performer: 'Người thực hiện', reviewLevels: 'Số cấp duyệt', reviewer: 'Người kiểm tra', dependsOn: 'Chờ bước', required: 'Bắt buộc', optional: 'Tuỳ chọn',
  statutory: 'Hạn pháp lý', delivery: 'Cần xác nhận giao nộp', obligationType: 'Loại nghĩa vụ (hạn theo lịch báo cáo của khách hàng)',
  noObligationType: 'Không gắn — hạn = cuối kỳ + số ngày lệch',
  evidence: 'Cần bằng chứng', evidenceHint: 'Gợi ý bằng chứng', instructions: 'Hướng dẫn', parallel: 'Làm song song với bước trước',
  editStep: 'Sửa bước', moveUp: 'Lên', moveDown: 'Xuống', remove: 'Xoá', edit: 'Sửa', none: '—', days: 'ngày',
  startDate: 'Ngày bắt đầu', period: 'Kỳ', totalDays: 'Tổng thời lượng', totalHint: 'ngày làm việc (trừ ngày nghỉ của năm đã xác nhận lịch)', from: 'Bắt đầu', to: 'Kết thúc / hạn',
  requirements: 'Hồ sơ yêu cầu', requirementName: 'Tên hồ sơ', category: 'Nhóm hồ sơ', perPeriod: 'Thu theo kỳ', once: 'Một lần',
  ifAny: 'Nếu có', forStep: 'Cần cho bước', noStep: 'Không gắn bước', addRequirement: 'Thêm hồ sơ', updateRequirement: 'Cập nhật hồ sơ',
  requirementNameError: 'Tên hồ sơ từ 2 đến 200 ký tự, không trùng', noRequirements: 'Chưa có hồ sơ yêu cầu',
  requirementsHint: 'Hồ sơ bắt buộc gắn với bước là điều kiện để bắt đầu bước đó khi thực hiện công việc.',
  defaultAssignee: 'Người thực hiện mặc định', defaultReviewer: 'Người kiểm tra mặc định', defaultApprover: 'Người phê duyệt mặc định',
  byContract: 'Theo người phụ trách HĐ/dịch vụ', byRole: 'Theo vai trò', dragHint: 'Kéo thả biểu tượng ở đầu dòng hoặc dùng nút lên/xuống để đổi thứ tự',
  stepNameError: 'Tên bước từ 2 đến 200 ký tự', loadError: 'Không tải được quy trình.', retry: 'Thử lại', notFound: 'Không tìm thấy quy trình hoặc phiên bản',
} as const;

export const WORKFLOW_STATUS: Record<WorkflowStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Nháp', color: 'orange' },
  PUBLISHED: { label: 'Đang hiệu lực', color: 'green' },
  RETIRED: { label: 'Ngừng', color: 'default' },
};

export const SCHEDULE_MODE_LABELS: Record<ScheduleMode, string> = {
  PERIODIC: 'Theo kỳ (hạn = cuối kỳ + số ngày)',
  PROJECT: 'Theo dự án (thời lượng nối theo bước chờ)',
};

export const WORKFLOW_ROLE_LABELS: Record<WorkflowRole, string> = {
  STAFF: 'Nhân viên / Kế toán',
  MANAGER: 'Trưởng nhóm / Kế toán trưởng',
  DIRECTOR: 'Giám đốc',
};

export const WORKFLOW_ROLE_OPTIONS = (Object.keys(WORKFLOW_ROLE_LABELS) as WorkflowRole[]).map((value) => ({
  value,
  label: WORKFLOW_ROLE_LABELS[value],
}));
