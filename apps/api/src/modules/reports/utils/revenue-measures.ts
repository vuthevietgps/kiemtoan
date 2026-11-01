import { Prisma } from '@prisma/client';
import type { Period } from './period.util';

/**
 * Báo cáo Doanh thu (đặc tả 10-D, M4–M5): 3 thước đo song song, không trộn —
 * **giá trị HĐ** (trước VAT, theo ngày duyệt), **đã xuất hoá đơn** (trước VAT, hoá đơn hiệu lực theo ngày
 * lập, gồm điều chỉnh âm), **đã thu** (gồm VAT, phiếu Đã duyệt theo ngày tiền về); so **cùng kỳ năm trước**.
 * Hoá đơn / phiếu thu không gắn dòng dịch vụ → khi nhóm theo loại dịch vụ hai thước đo này là null.
 */

const ZERO = new Prisma.Decimal(0);
export const REVENUE_GROUPS = [
  'serviceType',
  'customer',
  'owner',
  'month',
] as const;
export type RevenueGroup = (typeof REVENUE_GROUPS)[number];
export type Measure = 'contractValue' | 'invoiced' | 'paid';

/** Một khoản đóng góp vào một nhóm: khoá nhóm, tên, ngày tính (để nhóm theo tháng), số tiền, mã HĐ. */
export interface Entry {
  key: string;
  name: string;
  amount: Prisma.Decimal;
  contractId: string;
}

/** Cùng kỳ năm trước (29/02 → 28/02). */
export function sameRangeLastYear(p: Period): Period {
  const shift = (d: Date) => {
    const y = d.getUTCFullYear() - 1;
    const m = d.getUTCMonth();
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
  };
  return { from: shift(p.from), to: shift(p.to) };
}

/** Khoá tháng 'YYYY-MM'; kỳ năm trước dời +1 năm để ghép đúng tháng của kỳ này. */
export function monthKey(d: Date, yearShift = 0): string {
  return `${d.getUTCFullYear() + yearShift}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** % thay đổi 1 chữ số; kỳ so sánh 0 → null (M5). */
export function change(
  current: Prisma.Decimal | null,
  previous: Prisma.Decimal | null,
): number | null {
  if (current === null || previous === null || previous.isZero()) return null;
  return current
    .minus(previous)
    .div(previous.abs())
    .times(100)
    .toDecimalPlaces(1)
    .toNumber();
}

export interface RevenueRow {
  key: string;
  name: string;
  contracts: number;
  contractValue: Prisma.Decimal;
  invoiced: Prisma.Decimal | null;
  paid: Prisma.Decimal | null;
  previous: Record<Measure, Prisma.Decimal | null>;
  change: Record<Measure, number | null>;
}

type Sources = Record<Measure, Entry[]>;

function sum(entries: Entry[]) {
  const map = new Map<
    string,
    { name: string; value: Prisma.Decimal; contracts: Set<string> }
  >();
  for (const e of entries) {
    const row = map.get(e.key) ?? {
      name: e.name,
      value: ZERO,
      contracts: new Set<string>(),
    };
    row.value = row.value.plus(e.amount);
    row.contracts.add(e.contractId);
    map.set(e.key, row);
  }
  return map;
}

/**
 * Ghép 3 thước đo kỳ này và cùng kỳ năm trước theo khoá nhóm. Nhóm chỉ có ở kỳ trước vẫn hiện (giá trị
 * kỳ này 0) để không mất phần sụt giảm. Sắp xếp: theo tháng tăng dần, còn lại giá trị HĐ giảm dần.
 */
export function revenueRows(
  current: Sources,
  previous: Sources,
  group: RevenueGroup,
): RevenueRow[] {
  const split = group === 'serviceType';
  const now = {
    c: sum(current.contractValue),
    i: sum(current.invoiced),
    p: sum(current.paid),
  };
  const before = {
    c: sum(previous.contractValue),
    i: sum(previous.invoiced),
    p: sum(previous.paid),
  };
  const keys = new Map<string, string>();
  // Theo loại dịch vụ chỉ giá trị HĐ tạo nhóm (hoá đơn / phiếu thu không gắn dịch vụ).
  const grouped = split
    ? [now.c, before.c]
    : [now.c, now.i, now.p, before.c, before.i, before.p];
  for (const m of grouped)
    for (const [k, v] of m) if (!keys.has(k)) keys.set(k, v.name);
  const value = (m: ReturnType<typeof sum>, k: string) =>
    m.get(k)?.value ?? ZERO;
  const rows = [...keys.entries()].map(([key, name]): RevenueRow => {
    const cur = {
      contractValue: value(now.c, key),
      invoiced: split ? null : value(now.i, key),
      paid: split ? null : value(now.p, key),
    };
    const prev = {
      contractValue: value(before.c, key),
      invoiced: split ? null : value(before.i, key),
      paid: split ? null : value(before.p, key),
    };
    return {
      key,
      name,
      contracts: now.c.get(key)?.contracts.size ?? 0,
      ...cur,
      previous: prev,
      change: {
        contractValue: change(cur.contractValue, prev.contractValue),
        invoiced: change(cur.invoiced, prev.invoiced),
        paid: change(cur.paid, prev.paid),
      },
    };
  });
  return group === 'month'
    ? rows.sort((a, b) => a.key.localeCompare(b.key))
    : rows.sort((a, b) => b.contractValue.comparedTo(a.contractValue));
}

/** Tổng 3 thước đo (luôn đủ, kể cả khi nhóm theo loại dịch vụ). */
export function revenueTotals(current: Sources, previous: Sources) {
  const total = (s: Entry[]) => s.reduce((acc, e) => acc.plus(e.amount), ZERO);
  const contracts = new Set(current.contractValue.map((e) => e.contractId))
    .size;
  const cur = {
    contractValue: total(current.contractValue),
    invoiced: total(current.invoiced),
    paid: total(current.paid),
  };
  const prev = {
    contractValue: total(previous.contractValue),
    invoiced: total(previous.invoiced),
    paid: total(previous.paid),
  };
  return {
    contracts,
    ...cur,
    previous: prev,
    change: {
      contractValue: change(cur.contractValue, prev.contractValue),
      invoiced: change(cur.invoiced, prev.invoiced),
      paid: change(cur.paid, prev.paid),
    },
  };
}
