import { InvoiceKind, InvoiceStatus, Prisma } from '@prisma/client';

/** Luật sổ hoá đơn nội bộ (đặc tả 08, K1–K8) — hàm thuần. */

const Decimal = Prisma.Decimal;
type DecimalLike = Prisma.Decimal | string | number;
const { REQUESTED, ISSUED, ADJUSTED, REPLACED, CANCELLED } = InvoiceStatus;

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  REQUESTED: 'Chờ xuất',
  ISSUED: 'Đã xuất',
  ADJUSTED: 'Đã điều chỉnh',
  REPLACED: 'Bị thay thế',
  CANCELLED: 'Huỷ đề nghị',
};

export const INVOICE_KIND_LABEL: Record<InvoiceKind, string> = {
  ORIGINAL: 'Hoá đơn gốc',
  ADJUSTMENT: 'Hoá đơn điều chỉnh',
  REPLACEMENT: 'Hoá đơn thay thế',
};

/** Hoá đơn đã xuất còn hiệu lực (K6): gồm hoá đơn điều chỉnh (có thể âm); bị thay thế / huỷ thì không. */
export const EFFECTIVE_STATUSES: InvoiceStatus[] = [ISSUED, ADJUSTED];

/** Đề nghị / hoá đơn đang giữ phần giá trị HĐ (K2): chờ xuất + đã xuất hiệu lực. */
export const HOLDING_STATUSES: InvoiceStatus[] = [REQUESTED, ISSUED, ADJUSTED];

export { CANCELLED, REPLACED };

/**
 * Đề nghị theo đợt (K2, K3): tổng = tổng tiền các đợt (đợt đã gồm VAT); trước VAT = tổng / (1 + thuế
 * suất) làm tròn đồng, VAT = phần còn lại — tổng hoá đơn đúng bằng tổng đợt.
 */
export function splitTotal(total: DecimalLike, vatRate: DecimalLike) {
  const gross = new Decimal(total);
  const subtotal = gross
    .mul(100)
    .div(new Decimal(vatRate).add(100))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return { subtotal, vatAmount: gross.sub(subtotal), total: gross };
}

/** Giá trị trước VAT HĐ đang bị giữ bởi hoá đơn / đề nghị (K2). */
export function heldSubtotal(
  invoices: { status: InvoiceStatus; subtotal: DecimalLike }[],
): Prisma.Decimal {
  return invoices
    .filter((i) => HOLDING_STATUSES.includes(i.status))
    .reduce((sum, i) => sum.add(new Decimal(i.subtotal)), new Decimal(0));
}

/** Đã xuất (K8): tổng hoá đơn hiệu lực gồm VAT, kể cả điều chỉnh giảm. */
export function invoicedTotal(
  invoices: { status: InvoiceStatus; total: DecimalLike }[],
): Prisma.Decimal {
  return invoices
    .filter((i) => EFFECTIVE_STATUSES.includes(i.status))
    .reduce((sum, i) => sum.add(new Decimal(i.total)), new Decimal(0));
}

/** Đối chiếu thu – xuất một HĐ (K8). */
export function reconcile(paid: DecimalLike, invoiced: DecimalLike) {
  const diff = new Decimal(paid).sub(new Decimal(invoiced));
  return {
    paidNotInvoiced: diff.gt(0) ? diff : new Decimal(0),
    invoicedNotPaid: diff.lt(0) ? diff.neg() : new Decimal(0),
  };
}

/** Ký hiệu, mẫu số, số hoá đơn: bỏ khoảng trắng đầu/cuối, ký hiệu viết hoa — dùng chặn trùng (K5). */
export function normalizeIdentity(input: {
  templateCode: string;
  symbol: string;
  number: string;
}) {
  return {
    templateCode: input.templateCode.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    number: input.number.trim(),
  };
}
