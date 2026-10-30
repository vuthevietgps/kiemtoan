/** Nhãn và chữ của kho tài khoản khách hàng / chữ ký số (đặc tả 09). */

export type TokenProvider =
  'VNPT_CA' | 'VIETTEL_CA' | 'FPT_CA' | 'BKAV_CA' | 'MISA_CA' | 'EASY_CA' | 'OTHER';
export type TokenCustody = 'OFFICE' | 'CUSTOMER' | 'LOANED' | 'UNKNOWN';
export type CredentialEventType =
  | 'CREATED'
  | 'UPDATED'
  | 'SECRET_CHANGED'
  | 'STATUS_REPORTED'
  | 'STATUS_CHANGED'
  | 'SECRET_VIEWED'
  | 'SECRET_COPIED'
  | 'BORROWED'
  | 'RETURNED'
  | 'HANDED_OVER'
  | 'RECEIVED_FROM_CUSTOMER'
  | 'RETURNED_TO_CUSTOMER'
  | 'LOCATION_CHANGED'
  | 'DELETED';
export type CredentialKind = 'ACCOUNT' | 'TOKEN';

export const TOKEN_PROVIDER_LABELS: Record<TokenProvider, string> = {
  VNPT_CA: 'VNPT-CA',
  VIETTEL_CA: 'Viettel-CA',
  FPT_CA: 'FPT-CA',
  BKAV_CA: 'BKAV-CA',
  MISA_CA: 'MISA-CA',
  EASY_CA: 'EasyCA',
  OTHER: 'Khác',
};

export const CUSTODY_LABELS: Record<TokenCustody, string> = {
  OFFICE: 'Tại văn phòng',
  CUSTOMER: 'Khách hàng giữ',
  LOANED: 'Đang mượn',
  UNKNOWN: 'Chưa xác định',
};

export const CUSTODY_COLORS: Record<TokenCustody, string> = {
  OFFICE: 'blue',
  CUSTOMER: 'default',
  LOANED: 'gold',
  UNKNOWN: 'red',
};

export const EVENT_LABELS: Record<CredentialEventType, string> = {
  CREATED: 'Tạo',
  UPDATED: 'Sửa thông tin',
  SECRET_CHANGED: 'Đổi mật khẩu / PIN',
  STATUS_REPORTED: 'Báo lỗi',
  STATUS_CHANGED: 'Đổi trạng thái',
  SECRET_VIEWED: 'Xem mật khẩu',
  SECRET_COPIED: 'Sao chép mật khẩu',
  BORROWED: 'Mượn',
  RETURNED: 'Trả về văn phòng',
  HANDED_OVER: 'Giao cho nhân viên',
  RECEIVED_FROM_CUSTOMER: 'Nhận từ khách',
  RETURNED_TO_CUSTOMER: 'Trả khách',
  LOCATION_CHANGED: 'Đổi nơi cất',
  DELETED: 'Xoá',
};

/** Tên trường (sự kiện "Sửa thông tin" chỉ ghi tên trường, không ghi giá trị). */
export const FIELD_LABELS: Record<string, string> = {
  type: 'loại',
  label: 'tên',
  url: 'địa chỉ',
  username: 'tên đăng nhập',
  expiresAt: 'ngày hết hạn',
  note: 'ghi chú',
  provider: 'nhà cung cấp',
  serialNumber: 'số serial',
  storageLocation: 'nơi cất',
};

/** Thao tác mở hộp thoại nhập liệu từ ngăn chi tiết. */
export type CredentialDialog =
  'report' | 'borrow' | 'return' | 'handOver' | 'office' | 'customer' | 'delete';

export const DIALOG_TITLES: Record<CredentialDialog, string> = {
  report: 'Báo lỗi đăng nhập',
  borrow: 'Mượn token',
  return: 'Trả token về văn phòng',
  handOver: 'Giao token cho nhân viên',
  office: 'Cất tại văn phòng',
  customer: 'Trả token cho khách hàng',
  delete: 'Xoá tài khoản',
};

/** Giây hiện mật khẩu trước khi tự ẩn (L6). */
export const REVEAL_SECONDS = 30;
export const EXPIRY_WARNING_DAYS = 30;
export const MAX_LOAN_DAYS = 30;

export const CREDENTIALS_TEXT = {
  title: 'Tài khoản khách hàng',
  subtitle:
    'Mật khẩu được mã hoá; mỗi lần xem hoặc sao chép đều được ghi nhật ký. Chữ ký số: ai đang giữ, mượn / trả, hạn.',
  tabAccounts: 'Tài khoản cổng',
  tabTokens: 'Chữ ký số (token)',
  allCustomers: 'Tất cả khách hàng',
  allTypes: 'Tất cả loại',
  allStatuses: 'Tất cả trạng thái',
  allCustody: 'Mọi nơi giữ',
  searchAccounts: 'Tìm tên đăng nhập, tên, khách hàng',
  searchTokens: 'Tìm serial, khách hàng',
  expiring: 'Sắp hết hạn',
  overdueLoan: 'Mượn quá hạn',
  find: 'Tìm',
  add: 'Thêm tài khoản',
  addToken: 'Thêm token',
  customer: 'Khách hàng',
  type: 'Loại',
  username: 'Tên đăng nhập',
  status: 'Trạng thái',
  expiresAt: 'Hết hạn',
  provider: 'Nhà cung cấp',
  serial: 'Số serial',
  custody: 'Nơi giữ',
  holder: 'Người mượn',
  loanDue: 'Hạn trả',
  location: 'Nơi cất',
  url: 'Địa chỉ đăng nhập',
  note: 'Ghi chú',
  statusNote: 'Lỗi đã báo',
  secret: 'Mật khẩu',
  pin: 'Mã PIN',
  noSecret: 'Chưa lưu',
  secretChanged: 'Đổi mật khẩu gần nhất',
  purpose: 'Mục đích',
  updated: 'Cập nhật',
  view: 'Xem',
  copy: 'Sao chép',
  hide: 'Ẩn',
  copied: 'Đã sao chép — đã ghi nhật ký',
  copyFailed: 'Trình duyệt không cho phép sao chép',
  hidesIn: (s: number) => `Tự ẩn sau ${s} giây`,
  openPortal: 'Mở trang đăng nhập',
  edit: 'Sửa',
  history: 'Lịch sử',
  accessLog: 'Nhật ký xem / sao chép',
  emptyLog: 'Chưa có ai xem hoặc sao chép',
  migrated: 'Dữ liệu chuyển đổi',
  system: 'Hệ thống',
  detail: 'Chi tiết tài khoản',
  daysLeft: (n: number) =>
    n < 0 ? `Đã hết hạn ${-n} ngày` : n === 0 ? 'Hết hạn hôm nay' : `Còn ${n} ngày`,
  overdueBy: 'Quá hạn trả',
  unknownWarning:
    'Có token chưa xác định nơi giữ (dữ liệu chuyển đổi) — mở token và chọn "Cất tại văn phòng" hoặc "Trả khách".',
  expiringWarning: (n: number) => `${n} tài khoản / token hết hạn trong 30 ngày tới`,
  done: 'Đã lưu',
  cancel: 'Huỷ',
  save: 'Lưu',
  confirm: 'Xác nhận',
  reason: 'Lý do',
  receiver: 'Người nhận',
  issueStatus: 'Tình trạng',
  emptyAccounts: 'Chưa có tài khoản',
  emptyTokens: 'Chưa có token',
} as const;
