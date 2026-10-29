/** Chuỗi giao diện Cấu hình lịch & nhắc việc (06-D3). */
export const SETTINGS_TEXT = {
  title: 'Cấu hình lịch & nhắc việc',
  subtitle: 'Danh mục nghĩa vụ pháp lý, lịch làm việc theo năm, mốc nhắc và nhật ký gửi',
  tabTypes: 'Loại nghĩa vụ',
  tabCalendar: 'Lịch năm',
  tabReminders: 'Nhắc việc',
  tabDeliveries: 'Nhật ký gửi',
  save: 'Lưu',
  edit: 'Sửa',
  cancel: 'Huỷ',
  confirm: 'Xác nhận',
  saved: 'Đã lưu',
  reason: 'Lý do (5–500 ký tự)',
  none: '—',
  // Loại nghĩa vụ
  addType: 'Thêm loại nghĩa vụ',
  code: 'Mã',
  name: 'Tên',
  group: 'Nhóm',
  family: 'Nhóm thay thế',
  familyHint: 'Các biến thể cùng nhóm (ví dụ GTGT tháng/quý) — mặc định bằng mã',
  cycle: 'Chu kỳ',
  state: 'Trạng thái',
  services: 'Dịch vụ gắn',
  noServices: 'Chưa gắn dịch vụ — không sinh lịch báo cáo',
  retired: 'Đã ngừng',
  draft: 'Nháp',
  confirmedVersion: (n: number) => `Đã xác nhận v${n}`,
  draftVersion: (n: number) => `Nháp v${n}`,
  noConfirmed: 'Chưa xác nhận — chưa sinh hạn',
  rule: 'Quy tắc hạn',
  effectiveFrom: 'Áp dụng cho kỳ kết thúc từ ngày',
  dueRule: 'Cách tính hạn',
  monthsAfter: 'Số tháng sau tháng cuối kỳ',
  dueMonth: 'Tháng hạn',
  dueDay: 'Ngày hạn (31 = ngày cuối tháng)',
  useFiscalYear: 'Kỳ năm theo năm tài chính của khách hàng',
  holidayShift: 'Hạn trùng ngày nghỉ',
  conditions: 'Điều kiện áp dụng theo hồ sơ khách hàng (bỏ trống = mọi giá trị)',
  legalBasis: 'Căn cứ pháp lý',
  note: 'Ghi chú',
  saveDraft: 'Lưu bản nháp',
  editDraft: 'Sửa quy tắc (tạo nháp)',
  confirmDraft: 'Xác nhận bản nháp',
  confirmDraftHint:
    'Sau khi xác nhận, hệ thống sinh/tính lại lịch báo cáo theo quy tắc mới cho các kỳ chưa nộp, chưa tới hạn.',
  retire: 'Ngừng dùng',
  saveServices: 'Lưu dịch vụ gắn',
  preview: 'Xem trước hạn 12 kỳ tới',
  previewCustomer: 'Khách hàng mẫu',
  previewApplies: 'Khách hàng này thoả điều kiện áp dụng',
  previewNotApplies: 'Khách hàng này KHÔNG thoả điều kiện áp dụng',
  period: 'Kỳ',
  periodEnd: 'Cuối kỳ',
  ruleDue: 'Hạn theo quy tắc',
  dueDate: 'Hạn sau khi dời ngày nghỉ',
  synced: (created: number, retired: number, changed: number) =>
    `Đã đồng bộ: thêm ${created}, chuyển Không áp dụng ${retired}, đổi hạn ${changed}`,
  // Lịch năm
  year: 'Năm',
  yearConfirmed: 'Đã xác nhận',
  yearDraft: 'Chưa xác nhận — đang tính thứ 2 đến thứ 6',
  date: 'Ngày',
  pickDate: 'Chọn ngày',
  dayKind: 'Loại ngày',
  dayName: 'Tên (ví dụ "Nghỉ bù Quốc khánh")',
  addDay: 'Thêm ngày',
  remove: 'Xoá',
  noDays: 'Chưa có ngày nghỉ/làm bù nào',
  saveYear: 'Lưu lịch năm',
  confirmYear: 'Xác nhận lịch năm',
  confirmedEditHint: 'Lịch năm đã xác nhận: sửa cần lý do; hạn pháp lý và việc gắn sẽ được tính lại.',
  changedDues: (n: number) => (n ? ` — đổi hạn ${n} nghĩa vụ` : ''),
  dayError: 'Ngày phải thuộc năm đang chọn và có tên từ 2 ký tự',
  duplicateDay: 'Có ngày bị nhập trùng',
  // Nhắc việc
  thresholds: 'Ngưỡng mức gấp và mốc nhắc trước hạn (ngày)',
  soon: 'Sắp đến hạn ≤',
  priority: 'Cần ưu tiên ≤',
  near: 'Gần đến hạn ≤',
  thresholdError: 'Ba ngưỡng là số nguyên 1–90, giảm dần',
  sendTime: 'Giờ gửi (giờ Việt Nam)',
  escalation: 'Leo thang khi quá hạn (ngày làm việc)',
  serviceThresholds: 'Ngưỡng riêng theo dịch vụ',
  serviceThresholdsHint: 'Dịch vụ không có ngưỡng riêng dùng ngưỡng chung ở trên.',
  service: 'Dịch vụ',
  chooseService: 'Chọn dịch vụ',
  addThreshold: 'Thêm / cập nhật',
  runNow: 'Chạy nhắc ngay',
  ran: (inApp: number, email: number) => `Đã chạy: ${inApp} thông báo, ${email} email chờ gửi`,
  // Nhật ký gửi
  searchDelivery: 'Tìm theo tiêu đề',
  allStatuses: 'Mọi trạng thái',
  allChannels: 'Mọi kênh',
  createdAt: 'Lúc tạo',
  recipient: 'Người nhận',
  titleCol: 'Nội dung',
  channel: 'Kênh',
  attempts: 'Lần thử',
  lastError: 'Lỗi cuối',
  retry: 'Gửi lại',
  retried: 'Đã đưa vào hàng chờ gửi lại',
  smtpWarning:
    'Có email ở trạng thái "Không gửi" — thường do chưa cấu hình SMTP hoặc người nhận không có email. Thông báo trong ứng dụng vẫn được gửi.',
  noPermission: 'Bạn không có quyền xem phần này',
} as const;

export const GROUP_LABELS: Record<string, string> = {
  TAX: 'Thuế',
  FINANCIAL_STATEMENT: 'Báo cáo tài chính',
  OTHER: 'Khác',
};

export const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Tháng',
  QUARTERLY: 'Quý',
  YEARLY: 'Năm',
};

export const DUE_RULE_LABELS: Record<string, string> = {
  MONTH_AFTER_END: 'Ngày N của tháng thứ K sau tháng cuối kỳ',
  FIXED_IN_YEAR: 'Ngày/tháng cố định trong năm (chỉ nghĩa vụ năm)',
};

export const SHIFT_LABELS: Record<string, string> = {
  NEXT: 'Sang ngày làm việc kế tiếp',
  PREVIOUS: 'Về ngày làm việc trước',
};

export const DAY_KIND_LABELS: Record<string, string> = {
  DAY_OFF: 'Nghỉ (lễ, Tết, nghỉ bù)',
  WORKDAY: 'Làm bù (thứ 7/CN đi làm)',
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ gửi',
  SENDING: 'Đang gửi',
  SENT: 'Đã gửi',
  FAILED: 'Thất bại',
  SKIPPED: 'Không gửi',
  CANCELLED: 'Huỷ',
};

export const DELIVERY_STATUS_COLORS: Record<string, string> = {
  PENDING: 'blue',
  SENDING: 'processing',
  SENT: 'green',
  FAILED: 'red',
  SKIPPED: 'orange',
  CANCELLED: 'default',
};

export const CHANNEL_LABELS: Record<string, string> = {
  IN_APP: 'Trong ứng dụng',
  EMAIL: 'Email',
};

/** Trường điều kiện áp dụng (I5) — giá trị khớp hồ sơ thuế–kế toán của KH. */
export const CONDITION_FIELDS: { key: string; label: string; options: Record<string, string> }[] = [
  { key: 'taxPeriod', label: 'Kỳ khai GTGT', options: { MONTHLY: 'Theo tháng', QUARTERLY: 'Theo quý' } },
  {
    key: 'vatMethod',
    label: 'Phương pháp GTGT',
    options: { DEDUCTION: 'Khấu trừ', DIRECT: 'Trực tiếp', NONE: 'Không kê khai GTGT' },
  },
  {
    key: 'pitPeriod',
    label: 'Kỳ khai TNCN',
    options: { MONTHLY: 'Theo tháng', QUARTERLY: 'Theo quý', NONE: 'Không khấu trừ' },
  },
  {
    key: 'accountingRegime',
    label: 'Chế độ kế toán',
    options: { TT200: 'Thông tư 200', TT133: 'Thông tư 133', OTHER: 'Khác' },
  },
];
