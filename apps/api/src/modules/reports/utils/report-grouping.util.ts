import { InstallmentDueRule, Prisma } from '@prisma/client';
import { contractReceivable } from '../../payments/payment-allocation';

const ZERO = new Prisma.Decimal(0);

export function sumDecimals(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((acc, v) => acc.plus(v), ZERO);
}

export interface ReceivableContract {
  total: Prisma.Decimal;
  customer: { id: string; name: string; taxCode: string };
  installments: {
    id: string;
    amount: Prisma.Decimal;
    dueDate: Date;
    /** 07 J10: đợt chờ phát hành BCKT không tính quá hạn. */
    dueRule: InstallmentDueRule;
    milestoneDate: Date | null;
    allocations: { amount: Prisma.Decimal }[];
  }[];
  payments: { amount: Prisma.Decimal }[];
}

export interface ReceivableRow {
  customerId: string;
  customerName: string;
  taxCode: string;
  contracts: number;
  total: Prisma.Decimal;
  paid: Prisma.Decimal;
  remaining: Prisma.Decimal;
  overdue: Prisma.Decimal;
}

/** Công nợ theo khách hàng; quá hạn theo phân bổ đã lưu của từng HĐ (quy tắc chung 07 — sửa R1). */
export function summarizeReceivables(
  contracts: ReceivableContract[],
  today: Date,
): ReceivableRow[] {
  const rows = new Map<string, ReceivableRow>();
  for (const c of contracts) {
    const { paid, remaining, overdueAmount } = contractReceivable(c, today);
    const row = rows.get(c.customer.id) ?? {
      customerId: c.customer.id,
      customerName: c.customer.name,
      taxCode: c.customer.taxCode,
      contracts: 0,
      total: ZERO,
      paid: ZERO,
      remaining: ZERO,
      overdue: ZERO,
    };
    row.contracts += 1;
    row.total = row.total.plus(c.total);
    row.paid = row.paid.plus(paid);
    row.remaining = row.remaining.plus(
      remaining.isNegative() ? ZERO : remaining,
    );
    row.overdue = row.overdue.plus(overdueAmount);
    rows.set(c.customer.id, row);
  }
  return [...rows.values()].sort((a, b) => b.remaining.comparedTo(a.remaining));
}
