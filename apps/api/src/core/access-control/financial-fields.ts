import { Prisma } from '@prisma/client';

const FINANCIAL_KEYS = new Set([
  'subtotal',
  'vatRate',
  'vatAmount',
  'paidAmount',
  'remainingAmount',
  'pendingAmount',
  'overdueAmount',
  'invoicedSubtotal',
  'unitPrice',
  'amount',
  'defaultPrice',
  'installments',
  'payments',
  'invoices',
  'paymentStatus',
  'revenue',
  'totalPayable',
  'revenueByServiceType',
  'totalContractValue',
]);

/** Keep pagination/task counts named total; remove financial totals with their money fields. */
export function redactFinancialFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactFinancialFields);
  if (
    !value ||
    typeof value !== 'object' ||
    value instanceof Date ||
    Prisma.Decimal.isDecimal(value)
  )
    return value;
  const source = value as Record<string, unknown>;
  const moneyTotal =
    ['subtotal', 'unitPrice', 'paidAmount', 'vatAmount'].some(
      (key) => key in source,
    ) ||
    ('code' in source && 'startDate' in source);
  return Object.fromEntries(
    Object.entries(source)
      .filter(
        ([key]) => !FINANCIAL_KEYS.has(key) && !(key === 'total' && moneyTotal),
      )
      .map(([key, child]) => [key, redactFinancialFields(child)]),
  );
}
