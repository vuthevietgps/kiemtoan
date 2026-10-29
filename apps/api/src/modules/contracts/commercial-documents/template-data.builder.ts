import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { formatVnd, vndInWords } from '../../../common/utils/vnd-words.util';

/** Thông tin công ty trên hồ sơ; tạm đọc từ biến môi trường COMPANY_*, 11 chuyển sang Cài đặt. */
export interface CompanyProfile {
  name: string;
  taxCode: string;
  address: string;
  phone: string;
  representative: string;
  representativeTitle: string;
  bankAccount: string;
  bankName: string;
  /** Mã BIN 6 số của ngân hàng nhận, dùng tạo VietQR (07-D3). */
  bankBin: string;
}

const COMPANY_ENV: Record<keyof CompanyProfile, string> = {
  name: 'COMPANY_NAME',
  taxCode: 'COMPANY_TAX_CODE',
  address: 'COMPANY_ADDRESS',
  phone: 'COMPANY_PHONE',
  representative: 'COMPANY_REPRESENTATIVE',
  representativeTitle: 'COMPANY_REPRESENTATIVE_TITLE',
  bankAccount: 'COMPANY_BANK_ACCOUNT',
  bankName: 'COMPANY_BANK_NAME',
  bankBin: 'COMPANY_BANK_BIN',
};

export function companyProfile(config: ConfigService): CompanyProfile {
  return Object.fromEntries(
    Object.entries(COMPANY_ENV).map(([key, env]) => [
      key,
      config.get<string>(env, ''),
    ]),
  ) as unknown as CompanyProfile;
}

export const TEMPLATE_CONTRACT_SELECT = {
  id: true,
  code: true,
  status: true,
  customerId: true,
  signedDate: true,
  startDate: true,
  endDate: true,
  vatRate: true,
  subtotal: true,
  vatAmount: true,
  total: true,
  note: true,
  owner: { select: { fullName: true } },
  customer: {
    select: {
      name: true,
      taxCode: true,
      address: true,
      legalRep: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
    },
  },
  services: {
    select: {
      description: true,
      period: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      serviceType: { select: { code: true, name: true } },
    },
  },
  installments: {
    select: {
      id: true,
      name: true,
      amount: true,
      dueDate: true,
      // 07-D3: tiền đã thu (phân bổ đã duyệt) để tính số còn thiếu của đợt.
      allocations: { select: { amount: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
  },
} satisfies Prisma.ContractSelect;

export type TemplateContract = Prisma.ContractGetPayload<{
  select: typeof TEMPLATE_CONTRACT_SELECT;
}>;

/** Bỏ ký tự điều khiển và ký tự dùng làm dấu XML thô; giữ xuống dòng/tab. */
function clean(value: string | null | undefined): string {
  return [...(value ?? '')]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (
        (code >= 32 || char === '\n' || char === '\t') &&
        !(code >= 0xe000 && code <= 0xf8ff)
      );
    })
    .join('');
}

/** Ngày nghiệp vụ (kiểu date, lưu UTC 00:00) → dd/MM/yyyy. */
export function formatDate(value: Date | null): string {
  if (!value) return '';
  const day = String(value.getUTCDate()).padStart(2, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${value.getUTCFullYear()}`;
}

/** Ngày lập theo giờ Việt Nam. */
function todayParts(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    day: parts.day,
    month: parts.month,
    year: parts.year,
  };
}

const cleanAll = <T extends Record<string, string>>(record: T): T =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, clean(value)]),
  ) as T;

/** Nhóm 'payment' (07-D3): các đợt đề nghị thanh toán và ảnh VietQR (null khi chưa cấu hình ngân hàng). */
export interface PaymentTemplateData {
  installments: string;
  amount: string;
  amountInWords: string;
  dueDate: string;
  transferContent: string;
  qr: { width: number; height: number; data: Buffer; extension: string } | null;
}

const EMPTY_PAYMENT: PaymentTemplateData = {
  installments: '',
  amount: '',
  amountInWords: '',
  dueDate: '',
  transferContent: '',
  qr: null,
};

/** Dữ liệu trộn đúng theo danh sách trường công bố; mọi giá trị là chuỗi đã định dạng. */
export function buildTemplateData(
  contract: TemplateContract,
  company: CompanyProfile,
  now: Date,
  payment: PaymentTemplateData = EMPTY_PAYMENT,
): Record<string, unknown> {
  const { customer } = contract;
  return {
    company: cleanAll({ ...company }),
    payment: {
      ...cleanAll({
        installments: payment.installments,
        amount: payment.amount,
        amountInWords: payment.amountInWords,
        dueDate: payment.dueDate,
        transferContent: payment.transferContent,
      }),
      qr: payment.qr ?? undefined,
    },
    customer: cleanAll({
      name: customer.name,
      taxCode: customer.taxCode,
      address: customer.address ?? '',
      legalRep: customer.legalRep ?? '',
      contactName: customer.contactName ?? '',
      contactPhone: customer.contactPhone ?? '',
      contactEmail: customer.contactEmail ?? '',
    }),
    contract: cleanAll({
      code: contract.code,
      signedDate: formatDate(contract.signedDate),
      startDate: formatDate(contract.startDate),
      endDate: formatDate(contract.endDate),
      ownerName: contract.owner?.fullName ?? '',
      note: contract.note ?? '',
      vatRate: contract.vatRate.toString(),
      subtotal: formatVnd(contract.subtotal),
      vatAmount: formatVnd(contract.vatAmount),
      total: formatVnd(contract.total),
      subtotalInWords: vndInWords(contract.subtotal),
      totalInWords: vndInWords(contract.total),
    }),
    today: todayParts(now),
    services: contract.services.map((line, index) =>
      cleanAll({
        index: String(index + 1),
        code: line.serviceType.code,
        name: line.serviceType.name,
        description: line.description ?? '',
        period: line.period ?? '',
        quantity: String(line.quantity),
        unitPrice: formatVnd(line.unitPrice),
        amount: formatVnd(line.amount),
      }),
    ),
    installments: contract.installments.map((item, index) =>
      cleanAll({
        index: String(index + 1),
        name: item.name,
        dueDate: formatDate(item.dueDate),
        amount: formatVnd(item.amount),
        amountInWords: vndInWords(item.amount),
      }),
    ),
  };
}
