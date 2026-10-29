import { ContractStatus, DocumentTemplateType } from '@prisma/client';

/** Tên loại hồ sơ dùng đặt tên file sinh ra. */
export const TEMPLATE_TYPE_LABELS: Record<DocumentTemplateType, string> = {
  QUOTATION: 'Báo giá',
  CONTRACT: 'Hợp đồng',
  APPENDIX: 'Phụ lục',
  ACCEPTANCE: 'Biên bản nghiệm thu',
  LIQUIDATION: 'Biên bản thanh lý',
  PAYMENT_REQUEST: 'Đề nghị thanh toán',
};

const APPROVED: ContractStatus[] = [
  ContractStatus.NOT_STARTED,
  ContractStatus.IN_PROGRESS,
  ContractStatus.COMPLETED,
  ContractStatus.LIQUIDATED,
];

/**
 * Trạng thái HĐ được sinh từng loại hồ sơ (đặc tả 04-C): báo giá và dự thảo HĐ có thể lập trước
 * khi duyệt/ký; phụ lục, nghiệm thu, thanh lý, đề nghị thanh toán chỉ sau khi HĐ đã duyệt.
 */
export const GENERATABLE_STATUSES: Record<
  DocumentTemplateType,
  ContractStatus[]
> = {
  QUOTATION: [
    ContractStatus.DRAFT,
    ContractStatus.PENDING_APPROVAL,
    ...APPROVED,
  ],
  CONTRACT: [
    ContractStatus.DRAFT,
    ContractStatus.PENDING_APPROVAL,
    ...APPROVED,
  ],
  APPENDIX: APPROVED,
  ACCEPTANCE: APPROVED,
  LIQUIDATION: APPROVED,
  PAYMENT_REQUEST: APPROVED,
};

/** Bản scan đã ký chỉ nhận PDF hoặc ảnh để xem trước được (theo 02). */
export const SIGNED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
