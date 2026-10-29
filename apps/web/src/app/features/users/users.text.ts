export const USERS_TEXT = {
  title: 'Người dùng và phân quyền', subtitle: 'Tài khoản, nhóm và quyền truy cập trong phạm vi được phép',
  users: 'Người dùng', teams: 'Nhóm', roles: 'Vai trò và ma trận', requests: 'Yêu cầu cấp quyền',
  addUser: 'Thêm người dùng', editUser: 'Sửa người dùng', save: 'Lưu', cancel: 'Huỷ',
  search: 'Tìm theo họ tên, email', allRoles: 'Tất cả vai trò', allTeams: 'Tất cả nhóm', allStatuses: 'Tất cả trạng thái',
  fullName: 'Họ tên', email: 'Email', role: 'Vai trò nền', team: 'Nhóm', titleField: 'Chức danh', phone: 'Điện thoại',
  password: 'Mật khẩu ban đầu (tuỳ chọn)', passwordHint: 'Để trống để gửi lời mời. Nếu đặt mật khẩu, người dùng phải đổi ở lần đăng nhập đầu.',
  passwordPolicy: 'Mật khẩu mới: 10–72 ký tự, tối đa 72 byte, có chữ hoa, chữ thường, số và ký tự đặc biệt.',
  profile: 'Vai trò tuỳ chỉnh', defaultRole: 'Theo vai trò nền', financial: 'Xem tài chính', secret: 'Xem bí mật khách hàng',
  inherited: 'Theo mặc định', granted: 'Cho phép', denied: 'Không cho phép',
  status: 'Trạng thái', active: 'Hoạt động', locked: 'Đã khoá', invited: 'Chờ kích hoạt/đổi mật khẩu', left: 'Đã nghỉ việc', temporaryLock: 'Tạm khoá đăng nhập',
  lastLogin: 'Đăng nhập gần nhất', neverLogin: 'Chưa đăng nhập', empty: 'Không có dữ liệu',
  edit: 'Sửa', lock: 'Khoá', unlock: 'Mở khoá', invite: 'Gửi lời mời', reset: 'Gửi đặt lại mật khẩu', revoke: 'Thu hồi phiên', leave: 'Nghỉ việc',
  confirm: 'Xác nhận thao tác này?', pending: 'Chờ giám đốc duyệt quyền', pendingHint: 'Admin đề nghị thay đổi quyền; quyền hiện tại giữ nguyên đến khi giám đốc duyệt.',
  saved: 'Đã lưu người dùng', done: 'Đã thực hiện', errors: 'Không tải được dữ liệu. Vui lòng thử lại.', retry: 'Thử lại',
  accessResetHint: 'Khi đổi quyền, các phiên và liên kết cũ bị thu hồi. Với tài khoản chưa kích hoạt hoặc chưa đổi mật khẩu ban đầu, cần gửi lại lời mời sau khi duyệt quyền.',
  linkTitle: 'Bàn giao liên kết tài khoản', emailSent: 'Đã gửi email. Liên kết chỉ dùng một lần.',
  emailNotSent: 'Chưa gửi được email. Bàn giao riêng liên kết dưới đây cho đúng người dùng; không chia sẻ công khai.', expires: 'Hết hạn', close: 'Đóng',
  teamName: 'Tên nhóm', addTeam: 'Thêm nhóm', members: 'Thành viên', delete: 'Xoá',
  roleName: 'Tên vai trò', scope: 'Phạm vi dữ liệu', permissions: 'Quyền', addRole: 'Thêm vai trò',
  roleHint: 'Vai trò nghiệp vụ không được rộng hơn vai trò nền và không chứa quyền quản trị tài khoản/hệ thống.',
  requestedBy: 'Người đề nghị', target: 'Người dùng', proposal: 'Quyền đề nghị', requestedAt: 'Ngày đề nghị', reason: 'Lý do quyết định',
  approve: 'Duyệt', reject: 'Từ chối', reasonRequired: 'Nhập lý do từ 3 ký tự', review: 'Xử lý yêu cầu',
} as const;

export const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Hoạt động', LOCKED: 'Đã khoá', INVITED: 'Chờ kích hoạt/đổi mật khẩu', LEFT: 'Đã nghỉ việc' };
export const SCOPE_LABELS: Record<string, string> = { ALL: 'Toàn công ty', TEAM: 'Trong nhóm', OWN: 'Được phân công', NONE: 'Không có dữ liệu nghiệp vụ' };
export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Tổng quan', customers: 'Khách hàng', documents: 'Hồ sơ', 'service-catalog': 'Dịch vụ', 'workflow-templates': 'Quy trình mẫu', contracts: 'Hợp đồng',
  tasks: 'Công việc', deadlines: 'Deadline', payments: 'Thu tiền', invoices: 'Hoá đơn', 'client-credentials': 'Kho tài khoản KH',
  reports: 'Báo cáo', users: 'Người dùng', 'audit-log': 'Nhật ký', settings: 'Cài đặt', notifications: 'Thông báo', finance: 'Tài chính', 'access-control': 'Phân quyền',
};
export const ACTION_LABELS: Record<string, string> = {
  view: 'Xem', create: 'Thêm', update: 'Sửa', delete: 'Xoá', approve: 'Duyệt', export: 'Xuất',
  view_secret: 'Xem bí mật', view_financial: 'Xem tài chính', view_operations: 'Xem vận hành', manage_access: 'Đề nghị cấp quyền', plan: 'Xác nhận kế hoạch',
};
export function permissionLabel(permission: string): string {
  const [module, action] = permission.split(':');
  return `${MODULE_LABELS[module] ?? module}: ${ACTION_LABELS[action] ?? action}`;
}
