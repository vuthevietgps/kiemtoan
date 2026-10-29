import type {
  AcceptanceStatus,
  AuditStage,
  ClientDeliveryStatus,
  DeadlineKind,
  DeadlineResult,
  OriginalFilingStatus,
} from './data-access/audit-tracking.api';

/** Nhãn theo dõi HĐ kiểm toán (04-F). */
export const AUDIT_STAGES: AuditStage[] = [
  'NOT_STARTED',
  'FIELDWORK',
  'REVIEW',
  'AWAITING_ISSUE',
  'ISSUED',
];

export const AUDIT_STAGE_LABELS: Record<AuditStage, { label: string; color: string }> = {
  NOT_STARTED: { label: 'Chưa thực hiện', color: 'default' },
  FIELDWORK: { label: 'Đang kiểm toán', color: 'blue' },
  REVIEW: { label: 'Đang soát xét', color: 'purple' },
  AWAITING_ISSUE: { label: 'Chờ phát hành', color: 'gold' },
  ISSUED: { label: 'Đã phát hành', color: 'green' },
};

export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  FIELDWORK_END: 'Kết thúc kiểm toán',
  REVIEW_END: 'Hoàn tất soát xét',
  REPORT_ISSUE: 'Phát hành BCKT',
};

export const DEADLINE_RESULT_LABELS: Record<DeadlineResult, { label: string; color: string }> = {
  ON_TIME: { label: 'Đúng hạn', color: 'green' },
  LATE: { label: 'Trễ', color: 'red' },
  OVERDUE: { label: 'Quá hạn', color: 'red' },
  DUE_SOON: { label: 'Sắp đến hạn', color: 'orange' },
  PENDING: { label: 'Chưa tới hạn', color: 'default' },
};

export const CLIENT_DELIVERY_LABELS: Record<ClientDeliveryStatus, string> = {
  NOT_SENT: 'Chưa gửi',
  SOFT_COPY: 'Đã gửi bản mềm',
  SIGNED_SCAN: 'Đã gửi bản scan đã ký',
  HARD_COPY: 'Đã gửi bản cứng',
  HARD_AND_SOFT: 'Đã gửi đủ bản cứng và mềm',
};

export const ORIGINAL_FILING_LABELS: Record<OriginalFilingStatus, string> = {
  NOT_FILED: 'Chưa lưu',
  AWAITING_SIGNATURE: 'Đang chờ bản ký',
  FILED: 'Đã lưu',
};

export const ACCEPTANCE_LABELS: Record<AcceptanceStatus, string> = {
  NONE: 'Chưa có',
  AWAITING_SIGNATURE: 'Đang chờ ký',
  SIGNED: 'Đã ký',
};

export const INVOICE_LABELS: Record<'NONE' | 'REQUESTED' | 'ISSUED', string> = {
  NONE: 'Chưa có',
  REQUESTED: 'Đã đề nghị',
  ISSUED: 'Đã phát hành',
};

export const ROLE_LABELS: Record<string, string> = {
  MANAGER: 'Manager',
  LEAD: 'Trưởng nhóm',
  SIGNER1: 'Người ký 1',
  SIGNER2: 'Người ký 2',
  ASSISTANT: 'Trợ lý',
};

export const AUDIT_TEXT = {
  pageTitle: 'Theo dõi kiểm toán',
  pageSubtitle: 'Hồ sơ kiểm toán, hạn, người ký, hồ sơ HĐ và đúng hạn theo nhân sự',
  tabEngagements: 'Hồ sơ',
  tabPeople: 'Theo nhân sự',
  tabAudit: 'Kiểm toán',
  open: 'Theo dõi kiểm toán',
  search: 'Tên KH, MST, số HĐ, số BCKT',
  year: 'Năm',
  service: 'Dịch vụ',
  stage: 'Giai đoạn',
  owner: 'Người phụ trách HĐ',
  manager: 'Manager',
  lead: 'Trưởng nhóm',
  assistants: 'Trợ lý',
  signer: 'Người ký',
  signer1: 'Người ký 1',
  signer2: 'Người ký 2',
  deadlineFilter: 'Tình trạng hạn',
  deadlineOptions: {
    OVERDUE: 'Quá hạn',
    DUE_SOON: 'Sắp đến hạn',
    LATE: 'Có hạn trễ',
    EXTENDED: 'Đã gia hạn',
  },
  dossierIncomplete: 'Hồ sơ HĐ chưa đủ',
  uninvoiced: 'Đã phát hành, chưa hoá đơn',
  receivable: 'Còn phải thu',
  apply: 'Lọc',
  reset: 'Bỏ lọc',
  customer: 'Khách hàng',
  contract: 'Số HĐ',
  signedDate: 'Ngày ký',
  lineValue: 'Giá trị dòng (trước VAT)',
  contractTotal: 'Tổng HĐ',
  paid: 'Đã thu (theo HĐ)',
  remaining: 'Còn phải thu (theo HĐ)',
  issueDue: 'Hạn phát hành',
  reportNumber: 'Số BCKT',
  reportDate: 'Ngày phát hành',
  clientDelivery: 'Gửi HĐ',
  originalFiling: 'Bản gốc',
  invoice: 'Hoá đơn',
  acceptance: 'BBNT',
  extended: 'đã gia hạn',
  /** Ghi chú số ngày theo kết quả hạn: trễ / quá / còn N ngày; đúng hạn không ghi. */
  dayNote: (result: DeadlineResult, days: number) =>
    result === 'ON_TIME'
      ? ''
      : result === 'LATE'
        ? `trễ ${days} ngày`
        : result === 'OVERDUE'
          ? `quá ${days} ngày`
          : `còn ${days} ngày`,
  total: 'Hồ sơ',
  overdue: 'Quá hạn',
  dueSoon: 'Sắp đến hạn',
  otherOverdue: 'Có hạn khác quá hạn',
  noAudit: 'Hợp đồng không có dòng dịch vụ phát hành báo cáo kiểm toán.',
  detailTitle: 'Hồ sơ kiểm toán',
  team: 'Nhóm kiểm toán và người ký',
  deadlines: 'Hạn',
  originalDue: 'Hạn gốc',
  currentDue: 'Hạn hiện hành',
  result: 'Kết quả',
  deadlinesOpen: 'Hạn chưa chốt — sửa được đến khi bắt đầu kiểm toán.',
  deadlinesLocked: 'Hạn đã chốt khi bắt đầu kiểm toán; đổi hạn phải gia hạn (Giám đốc).',
  suggestedIssueDue: (d: string) => `Gợi ý theo kế hoạch thực hiện: ${d}`,
  useSuggestion: 'Dùng gợi ý',
  unassigned: 'Chưa được phân công khách hàng này (không tự mở quyền xem):',
  inactive: 'đã nghỉ',
  save: 'Lưu nhóm và hạn',
  saved: 'Đã lưu hồ sơ kiểm toán',
  next: (stage: string) => `Chuyển sang ${stage}`,
  back: 'Lùi giai đoạn',
  backTitle: 'Lùi giai đoạn',
  backTo: 'Lùi về',
  reason: 'Lý do (5–500 ký tự)',
  issue: 'Phát hành BCKT',
  issueTitle: 'Phát hành báo cáo kiểm toán',
  reportFile: 'File BCKT (PDF, tuỳ chọn)',
  reopen: 'Mở lại',
  reopenTitle: 'Mở lại báo cáo đã phát hành',
  extend: 'Gia hạn',
  extendTitle: (kind: string) => `Gia hạn: ${kind}`,
  newDue: 'Hạn mới',
  timeline: 'Dòng thời gian',
  history: 'Lịch sử gia hạn',
  cancel: 'Huỷ',
  confirm: 'Xác nhận',
  done: 'Đã cập nhật',
  dossierTitle: 'Tình trạng hồ sơ hợp đồng',
  deliveredAt: 'Ngày gửi',
  filedAt: 'Ngày lưu',
  filingNote: 'Vị trí lưu',
  signedAt: 'Ngày ký BBNT',
  acceptanceDoc: 'Bản BBNT đã ký',
  acceptanceDocHint: 'Tải bản đã ký loại "Biên bản nghiệm thu" ở tab Hồ sơ trước',
  dossierSaved: 'Đã lưu tình trạng hồ sơ',
  // 04-F4 — bám bảng LTGroup
  priority: 'Mức độ',
  notesTitle: 'Báo cáo tình hình cụ thể',
  notePlaceholder: 'Tình hình hiện tại của hồ sơ (vướng mắc, việc còn lại, hẹn với khách…)',
  addNote: 'Thêm cập nhật',
  noNotes: 'Chưa có cập nhật tình hình.',
  noteSaved: 'Đã thêm cập nhật tình hình',
  lastNote: 'Tình hình gần nhất',
  dossierSave: 'Lưu tình trạng hồ sơ',
  peopleFrom: 'Từ ngày',
  peopleTo: 'Đến ngày',
  role: 'Vai',
  kind: 'Loại hạn',
  person: 'Nhân sự',
  activeEngagements: 'Hồ sơ đang giữ vai',
  dueCount: 'Số hạn',
  onTime: 'Đúng hạn',
  late: 'Trễ',
  overdueCount: 'Quá hạn',
  rate: 'Tỷ lệ đúng hạn',
  rateOriginal: 'Đúng hạn gốc',
  extensions: 'Lần gia hạn',
  avgLate: 'Trễ TB (ngày)',
  personTitle: (name: string) => `Các hạn được tính — ${name}`,
  noData: '—',
  peopleHint:
    'Trễ hạn hồ sơ tính cho người giữ vai lúc hạn đến. Trợ lý được đánh giá theo công việc (05/10).',
} as const;
