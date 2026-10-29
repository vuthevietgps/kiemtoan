import { Prisma } from '@prisma/client';

/**
 * Quy tắc công nợ dùng chung (đặc tả 07, J4/J12 — sửa R1): phân bổ phiếu thu vào đợt và tính đã
 * thu, quá hạn, tuổi nợ. Hàm thuần; thu tiền, HĐ, KH, dashboard, báo cáo và file xuất cùng dùng.
 */
const Decimal = Prisma.Decimal;
type DecimalLike = Prisma.Decimal | string | number;
const ZERO = new Decimal(0);
const DAY_MS = 86_400_000;

export interface AllocInstallment {
  id: string;
  amount: DecimalLike;
  dueDate: Date;
  sortOrder?: number;
}

export interface AllocPayment {
  id: string;
  amount: DecimalLike;
  installmentId: string | null;
}

export interface Allocation {
  paymentId: string;
  installmentId: string;
  amount: Prisma.Decimal;
}

/** Thứ tự đợt nhận tiền dư / tiền không chỉ định: hạn sớm nhất trước (cùng thứ tự với migration). */
function byDue(a: AllocInstallment, b: AllocInstallment): number {
  return (
    a.dueDate.getTime() - b.dueDate.getTime() ||
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Phân bổ lần lượt từng phiếu (đã sắp theo thứ tự ghi nhận): phiếu chỉ định đợt vào đợt đó trước
 * (tối đa phần còn trống), phần dư và phiếu không chỉ định trừ dần các đợt hạn sớm nhất còn trống.
 * Tiền không còn đợt nào để phân bổ vẫn tính đã thu của HĐ, chỉ không gắn đợt.
 */
export function allocateContract(
  installments: AllocInstallment[],
  payments: AllocPayment[],
): Allocation[] {
  const sorted = [...installments].sort(byDue);
  const room = new Map(sorted.map((i) => [i.id, new Decimal(i.amount)]));
  const result = new Map<string, Allocation>();
  const put = (
    paymentId: string,
    installmentId: string,
    amount: Prisma.Decimal,
  ) => {
    const key = `${paymentId}|${installmentId}`;
    const existing = result.get(key);
    if (existing) existing.amount = existing.amount.add(amount);
    else result.set(key, { paymentId, installmentId, amount });
    room.set(installmentId, room.get(installmentId)!.sub(amount));
  };
  for (const p of payments) {
    let left = new Decimal(p.amount);
    const target = p.installmentId ? room.get(p.installmentId) : undefined;
    if (p.installmentId && target?.gt(0)) {
      const used = Decimal.min(target, left);
      put(p.id, p.installmentId, used);
      left = left.sub(used);
    }
    for (const i of sorted) {
      if (left.lte(0)) break;
      const free = room.get(i.id)!;
      if (free.lte(0)) continue;
      const used = Decimal.min(free, left);
      put(p.id, i.id, used);
      left = left.sub(used);
    }
  }
  return [...result.values()];
}

export type AgingBucket = '0-30' | '31-60' | '61-90' | '>90';

export function agingBucket(days: number): AgingBucket {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '>90';
}

export interface InstallmentBalance {
  id: string;
  amount: DecimalLike;
  dueDate: Date;
  /** Tổng tiền đã phân bổ vào đợt. */
  allocated: DecimalLike;
  /** J10: đợt theo mốc phát hành BCKT chưa phát hành — chưa có hạn, không quá hạn. */
  awaitingMilestone?: boolean;
}

export interface ReceivableSummary {
  paid: Prisma.Decimal;
  remaining: Prisma.Decimal;
  overdueAmount: Prisma.Decimal;
  /** Số ngày quá hạn của đợt quá hạn lâu nhất chưa thu đủ; null nếu chưa có đợt quá hạn. */
  overdueDays: number | null;
  ageBucket: AgingBucket | null;
}

/** Nhóm tuổi nợ của số tiền còn nợ (J12): chưa đến hạn hoặc theo số ngày quá hạn của đợt. */
export type AgingKey = 'notDue' | AgingBucket;
export const AGING_KEYS: AgingKey[] = [
  'notDue',
  '0-30',
  '31-60',
  '61-90',
  '>90',
];
export type AgingTotals = Record<AgingKey, Prisma.Decimal>;

export interface InstallmentState {
  id: string;
  /** Số tiền đợt còn thiếu sau phân bổ (không âm). */
  remaining: Prisma.Decimal;
  /** Số ngày từ hôm nay đến hạn (âm = đã quá hạn, 0 = đến hạn hôm nay); null = chờ phát hành BCKT (J10). */
  dueInDays: number | null;
  /** Số ngày quá hạn khi hạn trước hôm nay và còn thiếu; null nếu chưa quá hạn hoặc đã thu đủ. */
  overdueDays: number | null;
  bucket: AgingBucket | null;
}

/** Trạng thái từng đợt tại `today` (ngày nghiệp vụ 00:00 UTC theo giờ VN) — J12. */
export function installmentStates(
  installments: InstallmentBalance[],
  today: Date,
): InstallmentState[] {
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return installments.map((i) => {
    const left = new Decimal(i.amount).sub(new Decimal(i.allocated));
    const remaining = left.gt(0) ? left : ZERO;
    const dueInDays = i.awaitingMilestone
      ? null
      : Math.floor((i.dueDate.getTime() - start) / DAY_MS);
    const overdueDays =
      dueInDays !== null && dueInDays < 0 && remaining.gt(0)
        ? -dueInDays
        : null;
    return {
      id: i.id,
      remaining,
      dueInDays,
      overdueDays,
      bucket: overdueDays === null ? null : agingBucket(overdueDays),
    };
  });
}

export function emptyAging(): AgingTotals {
  return Object.fromEntries(AGING_KEYS.map((k) => [k, ZERO])) as AgingTotals;
}

export function addAging(a: AgingTotals, b: AgingTotals): AgingTotals {
  return Object.fromEntries(
    AGING_KEYS.map((k) => [k, a[k].add(b[k])]),
  ) as AgingTotals;
}

/**
 * Tuổi nợ một HĐ (J12): phần quá hạn chia theo tuổi từng đợt; "Chưa đến hạn" = còn phải thu − quá hạn
 * (gồm cả phần chưa gắn đợt) để tổng các nhóm bằng số còn phải thu.
 */
export function agingOf(
  remaining: DecimalLike,
  states: InstallmentState[],
): AgingTotals {
  const totals = emptyAging();
  let overdue = ZERO;
  for (const s of states) {
    if (!s.bucket) continue;
    totals[s.bucket] = totals[s.bucket].add(s.remaining);
    overdue = overdue.add(s.remaining);
  }
  const notDue = new Decimal(remaining).sub(overdue);
  totals.notDue = notDue.gt(0) ? notDue : ZERO;
  return totals;
}

/** Tiền còn thiếu của các đợt đến hạn trong `days` ngày tới (kể cả hôm nay). */
export function upcomingAmount(
  states: InstallmentState[],
  days = 7,
): Prisma.Decimal {
  return states
    .filter(
      (s) => s.dueInDays !== null && s.dueInDays >= 0 && s.dueInDays <= days,
    )
    .reduce((acc, s) => acc.add(s.remaining), ZERO);
}

/**
 * Công nợ một HĐ tại `today` (ngày nghiệp vụ 00:00 UTC theo giờ VN): đợt quá hạn = hạn trước hôm nay
 * và còn thiếu sau phân bổ. `paid` = tổng phiếu được tính (cả phần không gắn đợt).
 */
export function summarizeReceivable(
  total: DecimalLike,
  installments: InstallmentBalance[],
  paid: DecimalLike,
  today: Date,
): ReceivableSummary {
  const paidAmount = new Decimal(paid);
  const overdue = installmentStates(installments, today).filter(
    (s) => s.overdueDays !== null,
  );
  const overdueDays = overdue.length
    ? Math.max(...overdue.map((s) => s.overdueDays!))
    : null;
  return {
    paid: paidAmount,
    remaining: new Decimal(total).sub(paidAmount),
    overdueAmount: overdue.reduce((acc, s) => acc.add(s.remaining), ZERO),
    overdueDays,
    ageBucket: overdueDays === null ? null : agingBucket(overdueDays),
  };
}

/** Tổng phân bổ theo đợt. */
export function allocatedByInstallment(
  allocations: { installmentId: string; amount: DecimalLike }[],
): Map<string, Prisma.Decimal> {
  const map = new Map<string, Prisma.Decimal>();
  for (const a of allocations)
    map.set(
      a.installmentId,
      (map.get(a.installmentId) ?? ZERO).add(new Decimal(a.amount)),
    );
  return map;
}

/**
 * Mốc phát hành BCKT của HĐ (J10): mọi dòng dịch vụ phát hành BCKT đã phát hành → ngày phát hành muộn
 * nhất; còn dòng chưa phát hành (hoặc HĐ không có dòng nào) → null (đợt theo mốc đang chờ).
 */
export function reportMilestone(
  lines: { issued: boolean; reportDate: Date | null }[],
): Date | null {
  if (!lines.length || lines.some((l) => !l.issued || !l.reportDate))
    return null;
  return new Date(Math.max(...lines.map((l) => l.reportDate!.getTime())));
}
