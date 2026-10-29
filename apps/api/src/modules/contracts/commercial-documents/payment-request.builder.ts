import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { formatVnd, vndInWords } from '../../../common/utils/vnd-words.util';
import { transferText, vietQrPayload } from '../../../common/utils/vietqr';
import {
  type CompanyProfile,
  formatDate,
  type PaymentTemplateData,
  type TemplateContract,
} from './template-data.builder';

/** Kích thước ảnh mã QR chèn vào Word (cm). */
const QR_SIZE_CM = 4;

export interface PaymentRequestPreview {
  installments: {
    id: string;
    name: string;
    dueDate: Date;
    remaining: Prisma.Decimal;
  }[];
  amount: Prisma.Decimal;
  amountInWords: string;
  transferContent: string;
  bank: {
    bin: string;
    accountNumber: string;
    bankName: string;
    accountName: string;
  };
  /** Chuỗi VietQR; null khi chưa cấu hình ngân hàng nhận. */
  qrPayload: string | null;
}

/** Ngân hàng nhận đủ để tạo VietQR (mã BIN và số tài khoản). */
export function bankConfigured(company: CompanyProfile): boolean {
  return !!company.bankBin.trim() && !!company.bankAccount.trim();
}

/**
 * Đợt còn nợ của HĐ (sau phân bổ phiếu đã duyệt) và phần được chọn: `ids` null = mọi đợt còn nợ
 * (mẫu hồ sơ khác dùng nhóm payment); có `ids` thì mọi đợt phải thuộc HĐ và còn nợ (J9).
 */
export function selectInstallments(
  contract: TemplateContract,
  ids: string[] | null,
): PaymentRequestPreview['installments'] {
  const open = contract.installments
    .map((i) => ({
      id: i.id,
      name: i.name,
      dueDate: i.dueDate,
      remaining: i.allocations.reduce(
        (left, a) => left.sub(a.amount),
        new Prisma.Decimal(i.amount),
      ),
    }))
    .filter((i) => i.remaining.gt(0));
  if (!ids) return open;
  const unique = [...new Set(ids)];
  const picked = open.filter((i) => unique.includes(i.id));
  if (!unique.length || picked.length !== unique.length)
    throw new BadRequestException(
      'Chỉ đề nghị thanh toán cho đợt còn nợ của hợp đồng này',
    );
  return picked;
}

/** Số liệu xem trước: đợt, số tiền, bằng chữ, nội dung chuyển khoản, chuỗi VietQR. */
export function previewPaymentRequest(
  contract: TemplateContract,
  company: CompanyProfile,
  ids: string[] | null,
): PaymentRequestPreview {
  const installments = selectInstallments(contract, ids);
  const amount = installments.reduce(
    (sum, i) => sum.add(i.remaining),
    new Prisma.Decimal(0),
  );
  const transferContent = transferText(`TT ${contract.code}`);
  let qrPayload: string | null = null;
  if (bankConfigured(company) && amount.gt(0)) {
    try {
      qrPayload = vietQrPayload({
        bin: company.bankBin,
        accountNumber: company.bankAccount,
        amount: amount.toDecimalPlaces(0).toNumber(),
        content: transferContent,
      });
    } catch (error) {
      throw new BadRequestException(
        `Cấu hình ngân hàng nhận không hợp lệ: ${(error as Error).message}`,
      );
    }
  }
  return {
    installments,
    amount,
    amountInWords: vndInWords(amount),
    transferContent,
    bank: {
      bin: company.bankBin,
      accountNumber: company.bankAccount,
      bankName: company.bankName,
      accountName: company.name,
    },
    qrPayload,
  };
}

/** Nhóm `payment` cho mẫu Word: chuỗi đã định dạng và ảnh QR (PNG). */
export async function paymentTemplateData(
  preview: PaymentRequestPreview,
): Promise<PaymentTemplateData> {
  const earliest = preview.installments
    .map((i) => i.dueDate)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return {
    installments: preview.installments.map((i) => i.name).join(', '),
    amount: formatVnd(preview.amount),
    amountInWords: preview.amountInWords,
    dueDate: formatDate(earliest ?? null),
    transferContent: preview.transferContent,
    qr: preview.qrPayload
      ? {
          width: QR_SIZE_CM,
          height: QR_SIZE_CM,
          data: await qrPng(preview.qrPayload),
          extension: '.png',
        }
      : null,
  };
}

export function qrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 400,
  });
}

/** Ảnh QR dạng data URL để xem trước trên màn hình. */
export function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });
}
