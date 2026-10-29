import { Prisma } from '@prisma/client';

/** Logic tính tiền / mã chứng từ thuần (không truy cập database) — dùng chung cho contracts, payments, invoices. */
const Decimal = Prisma.Decimal;
type DecimalLike = Prisma.Decimal | string | number;

/** Trạng thái thanh toán HĐ; 07-D2 thêm OVERDUE = chưa thu đủ và có đợt quá hạn (quy tắc chung J12). */
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface LineInput {
  quantity: number;
  unitPrice: DecimalLike;
}

export interface ContractTotals {
  lineAmounts: Prisma.Decimal[];
  subtotal: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  total: Prisma.Decimal;
}

export function sumDecimal(values: DecimalLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (acc, v) => acc.add(new Decimal(v)),
    new Decimal(0),
  );
}

/** Tiền VAT làm tròn đến đồng. */
export function vatOf(
  subtotal: DecimalLike,
  vatRate: DecimalLike,
): Prisma.Decimal {
  return new Decimal(subtotal)
    .mul(new Decimal(vatRate))
    .div(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/** amount = quantity × unitPrice; subtotal = Σ amount; total = subtotal + VAT. */
export function computeTotals(
  lines: LineInput[],
  vatRate: DecimalLike,
): ContractTotals {
  const lineAmounts = lines.map((l) =>
    new Decimal(l.unitPrice).mul(l.quantity),
  );
  const subtotal = sumDecimal(lineAmounts);
  const vatAmount = vatOf(subtotal, vatRate);
  return { lineAmounts, subtotal, vatAmount, total: subtotal.add(vatAmount) };
}

/** Mã chứng từ dạng PREFIX-YYYY-NNN, ví dụ HD-2025-015. */
export function formatCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
}

/** Số thứ tự tiếp theo từ danh sách mã đã có cùng tiền tố năm. */
export function nextSequence(existingCodes: string[]): number {
  const max = existingCodes.reduce((acc, code) => {
    const n = Number(code.split('-').pop());
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return max + 1;
}

export function paymentStatusOf(
  total: DecimalLike,
  paid: DecimalLike,
  overdue: DecimalLike = 0,
): PaymentStatus {
  const p = new Decimal(paid);
  if (p.lt(new Decimal(total)) && new Decimal(overdue).gt(0)) return 'OVERDUE';
  if (p.lte(0)) return new Decimal(total).lte(0) ? 'PAID' : 'UNPAID';
  return p.gte(new Decimal(total)) ? 'PAID' : 'PARTIAL';
}

/** Số đã thu + số thu mới không được vượt tổng phải thu. */
export function exceedsRemaining(
  total: DecimalLike,
  paid: DecimalLike,
  amount: DecimalLike,
): boolean {
  return new Decimal(paid).add(new Decimal(amount)).gt(new Decimal(total));
}
