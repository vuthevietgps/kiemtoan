import { PricingBasis, PriceListStatus } from './data-access/service-catalog.api';

export const SERVICE_CATALOG_TEXT = {
  title: 'Dịch vụ & bảng giá', subtitle: 'Danh mục dịch vụ, bảng giá theo bậc và quy trình mặc định', add: 'Thêm dịch vụ',
  search: 'Tìm theo mã hoặc tên', allStatuses: 'Tất cả trạng thái', activeOnly: 'Đang cung cấp', inactiveOnly: 'Ngừng',
  code: 'Mã', name: 'Tên dịch vụ', cycle: 'Chu kỳ', defaultPrice: 'Giá chuẩn', pricingBasis: 'Tiêu chí bảng giá',
  pricingUnit: 'Đơn vị tiêu chí', pricingUnitHint: 'Ví dụ: chứng từ/tháng', status: 'Trạng thái',
  workflows: 'Quy trình mẫu', defaultWorkflow: 'Quy trình mặc định', noWorkflow: 'Chưa có quy trình', noActiveWorkflow: 'Chưa phát hành',
  edit: 'Sửa', priceLists: 'Bảng giá', addService: 'Thêm dịch vụ', editService: 'Sửa dịch vụ',
  loadError: 'Không tải được danh mục dịch vụ.', retry: 'Thử lại', saved: 'Đã lưu dịch vụ',
  priceListsTitle: 'Bảng giá', addPriceList: 'Thêm bảng giá', editPriceList: 'Sửa bảng giá',
  effectiveFrom: 'Áp dụng từ', note: 'Ghi chú', tiers: 'Bậc giá', from: 'Từ (≥)', to: 'Đến (<)', unlimited: 'Không giới hạn',
  unitPrice: 'Đơn giá', flatPrice: 'Đơn giá áp dụng', addTier: 'Thêm bậc', removeTier: 'Xoá bậc', noPriceLists: 'Chưa có bảng giá; báo giá dùng giá chuẩn',
  remove: 'Xoá', confirmRemove: 'Xoá bảng giá sắp áp dụng này?', removed: 'Đã xoá bảng giá', priceListSaved: 'Đã lưu bảng giá',
  lockedHint: 'Bảng giá đã hoặc đang áp dụng không sửa được; hãy tạo bảng giá mới.',
  basisSnapshot: 'Tiêu chí của bảng giá', cancel: 'Huỷ', save: 'Lưu',
  effectiveError: 'Vui lòng chọn ngày áp dụng từ hôm nay trở đi', priceError: 'Vui lòng nhập đơn giá',
  toError: 'Giá trị "đến" phải lớn hơn giá trị "từ"', serviceCodeError: 'Vui lòng nhập mã', serviceNameError: 'Vui lòng nhập tên dịch vụ',
  description: 'Mô tả', isActive: 'Đang cung cấp',
  issuesAuditReport: 'Phát hành báo cáo kiểm toán',
  issuesAuditReportHint: 'Bật để theo dõi nhóm kiểm toán, người ký, giai đoạn và số báo cáo cho từng dòng hợp đồng của dịch vụ này',
} as const;

export const PRICING_BASIS_LABELS: Record<PricingBasis, string> = {
  NONE: 'Một mức giá (không theo bậc)',
  DOCUMENT_COUNT: 'Số chứng từ mỗi tháng',
  ANNUAL_REVENUE: 'Doanh thu năm',
  EMPLOYEE_COUNT: 'Số lao động',
  OTHER: 'Khác',
};

export const PRICING_BASIS_OPTIONS = (Object.keys(PRICING_BASIS_LABELS) as PricingBasis[]).map((value) => ({
  value,
  label: PRICING_BASIS_LABELS[value],
}));

export const PRICE_LIST_STATUS: Record<PriceListStatus, { label: string; color: string }> = {
  UPCOMING: { label: 'Sắp áp dụng', color: 'blue' },
  ACTIVE: { label: 'Đang áp dụng', color: 'green' },
  EXPIRED: { label: 'Đã thay thế', color: 'default' },
};
