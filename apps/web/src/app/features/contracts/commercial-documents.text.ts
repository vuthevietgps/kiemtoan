import { ContractStatus } from './contract-labels';
import { DocumentSource, TemplateType } from './data-access/commercial-documents.api';

/** Chuỗi giao diện hồ sơ thương mại và mẫu Word (04-C). */
export const COMMERCIAL_TEXT = {
  title: 'Hồ sơ thương mại',
  hint: 'Hồ sơ sinh từ mẫu Word và bản scan đã ký được lưu vào kho hồ sơ của khách hàng, nhóm Hợp đồng.',
  template: 'Mẫu hồ sơ',
  chooseTemplate: 'Chọn mẫu',
  target: 'Lưu thành',
  newDocument: 'Hồ sơ mới',
  newVersionOf: 'Phiên bản mới của',
  generate: 'Tạo hồ sơ',
  generated: 'Đã tạo hồ sơ',
  noTemplate: 'Chưa có mẫu đang dùng cho trạng thái hợp đồng này.',
  signedTitle: 'Bản scan đã ký',
  signedType: 'Loại hồ sơ',
  signedFile: 'Chọn file PDF/ảnh',
  signedUploaded: 'Đã tải bản đã ký',
  signedInvalid: 'Bản scan đã ký phải là PDF, PNG hoặc JPEG, tối đa 20 MB',
  type: 'Loại',
  source: 'Nguồn',
  file: 'Tệp',
  version: 'Phiên bản',
  updated: 'Cập nhật',
  by: 'Người tạo',
  empty: 'Chưa có hồ sơ thương mại',
  download: 'Tải về',
  preview: 'Xem',
  previewTitle: 'Xem trước bản đã ký',
  templateVersion: 'Mẫu',
  retry: 'Tải lại',
  financeHint: 'Tạo hồ sơ cần quyền xem tài chính vì hồ sơ có số tiền.',
} as const;

/** Chuỗi trang quản lý mẫu. */
export const TEMPLATES_TEXT = {
  title: 'Mẫu hồ sơ',
  subtitle:
    'Mẫu Word có trường trộn để tạo báo giá, hợp đồng, phụ lục, biên bản, đề nghị thanh toán',
  back: 'Hợp đồng',
  upload: 'Tải mẫu mới',
  name: 'Tên mẫu',
  description: 'Mô tả',
  type: 'Loại',
  file: 'Chọn file .docx',
  status: 'Trạng thái',
  active: 'Đang dùng',
  inactive: 'Ngừng dùng',
  version: 'Phiên bản',
  fields: 'Trường dùng',
  updated: 'Cập nhật',
  activate: 'Dùng lại',
  deactivate: 'Ngừng dùng',
  newVersion: 'Thay file',
  history: 'Lịch sử',
  download: 'Tải về',
  sample: 'Tải mẫu ví dụ',
  sampleHint: 'Mẫu ví dụ có sẵn trường trộn để sửa thành mẫu của công ty.',
  catalog: 'Danh sách trường trộn',
  catalogHint:
    'Gõ trường trong file Word giữa {{ và }}, ví dụ {{customer.name}}. Bảng lặp: ô đầu {{FOR item IN services}}{{$item.name}}, ô cuối {{$item.amount}}{{END-FOR item}}.',
  list: 'Danh sách',
  invalidFile: 'Chỉ nhận file .docx tối đa 20 MB',
  nameRequired: 'Tên mẫu từ 2 đến 200 ký tự',
  created: 'Đã tải mẫu lên',
  replaced: 'Đã thay file mẫu',
  saved: 'Đã cập nhật mẫu',
  note: 'Ghi chú thay đổi',
  versionsTitle: 'Lịch sử phiên bản mẫu',
  empty: 'Chưa có mẫu',
  cancel: 'Huỷ',
  save: 'Tải lên',
  all: 'Tất cả loại',
  draftNote: 'Chưa có mẫu Word thật của công ty (QD07); mẫu ví dụ chỉ để thử.',
} as const;

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  QUOTATION: 'Báo giá',
  CONTRACT: 'Hợp đồng',
  APPENDIX: 'Phụ lục',
  ACCEPTANCE: 'Biên bản nghiệm thu',
  LIQUIDATION: 'Biên bản thanh lý',
  PAYMENT_REQUEST: 'Đề nghị thanh toán',
};

export const TEMPLATE_TYPES = Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[];

export const SOURCE_LABELS: Record<DocumentSource, { label: string; color: string }> = {
  GENERATED: { label: 'Sinh từ mẫu', color: 'blue' },
  SIGNED: { label: 'Bản đã ký', color: 'green' },
};

const APPROVED: ContractStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'LIQUIDATED'];

/** Khớp API: báo giá/dự thảo HĐ lập được trước khi duyệt, loại khác chỉ sau khi duyệt. */
export const GENERATABLE_STATUSES: Record<TemplateType, ContractStatus[]> = {
  QUOTATION: ['DRAFT', 'PENDING_APPROVAL', ...APPROVED],
  CONTRACT: ['DRAFT', 'PENDING_APPROVAL', ...APPROVED],
  APPENDIX: APPROVED,
  ACCEPTANCE: APPROVED,
  LIQUIDATION: APPROVED,
  PAYMENT_REQUEST: APPROVED,
};
