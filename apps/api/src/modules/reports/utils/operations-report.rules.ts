/**
 * Quy tắc thuần của báo cáo vận hành (đặc tả 10-C; M6–M8). Ngày nghiệp vụ là Date 00:00 UTC theo lịch
 * Việt Nam (như cột `date`). Không đọc DB.
 */

const DAY_MS = 86_400_000;

export type ComplianceOutcome = 'ON_TIME' | 'LATE' | 'OVERDUE' | 'NOT_DUE';

/**
 * M6: kết quả một hạn — đã nộp / hoàn thành không sau hạn = đúng hạn; sau hạn = trễ (số ngày trễ); chưa
 * nộp mà hạn < hôm nay = quá hạn chưa nộp; còn lại = chưa đến hạn.
 */
export function complianceOutcome(
  dueDate: Date,
  doneOn: Date | null,
  today: Date,
): { outcome: ComplianceOutcome; daysLate: number } {
  if (doneOn) {
    const late = Math.round((doneOn.getTime() - dueDate.getTime()) / DAY_MS);
    return late > 0
      ? { outcome: 'LATE', daysLate: late }
      : { outcome: 'ON_TIME', daysLate: 0 };
  }
  if (dueDate < today)
    return {
      outcome: 'OVERDUE',
      daysLate: Math.round((today.getTime() - dueDate.getTime()) / DAY_MS),
    };
  return { outcome: 'NOT_DUE', daysLate: 0 };
}

/** Tỷ lệ % (1 chữ số) = phần / tổng; tổng 0 → null (giao diện hiện "—"). */
export function ratio(part: number, whole: number): number | null {
  return whole ? Math.round((part / whole) * 1000) / 10 : null;
}

export interface ComplianceCounts {
  onTime: number;
  late: number;
  overdue: number;
  notDue: number;
  clientDelay: number;
}

export const emptyCounts = (): ComplianceCounts => ({
  onTime: 0,
  late: 0,
  overdue: 0,
  notDue: 0,
  clientDelay: 0,
});

export function addOutcome(
  counts: ComplianceCounts,
  outcome: ComplianceOutcome,
  clientDelay: boolean,
): void {
  if (outcome === 'ON_TIME') counts.onTime++;
  else if (outcome === 'LATE') counts.late++;
  else if (outcome === 'OVERDUE') counts.overdue++;
  else counts.notDue++;
  if (clientDelay && (outcome === 'LATE' || outcome === 'OVERDUE'))
    counts.clientDelay++;
}

/** Tỷ lệ đúng hạn = đúng hạn / (đúng hạn + trễ + quá hạn chưa nộp). */
export const onTimeRate = (c: ComplianceCounts) =>
  ratio(c.onTime, c.onTime + c.late + c.overdue);

/** Hợp đồng dùng để tính hiệu lực (đã duyệt, không nháp / chờ duyệt / huỷ). */
export interface ContractSpan {
  approvedOn: Date | null;
  startDate: Date;
  endDate: Date | null;
}

/** Hiệu lực tại ngày `day`: đã duyệt đến ngày đó, đã bắt đầu, chưa kết thúc trước ngày đó. */
export function effectiveOn(c: ContractSpan, day: Date): boolean {
  return (
    !!c.approvedOn &&
    c.approvedOn <= day &&
    c.startDate <= day &&
    (!c.endDate || c.endDate >= day)
  );
}

export interface Period {
  from: Date;
  to: Date;
}

const inPeriod = (d: Date | null, p: Period) => !!d && d >= p.from && d <= p.to;

/**
 * M8 cho một khách hàng: **mới** = HĐ đầu tiên được duyệt trong kỳ; **ngừng** = HĐ hiệu lực cuối cùng kết
 * thúc trong kỳ và không còn HĐ nào hiệu lực / bắt đầu sau ngày đó; **có đầu kỳ / còn cuối kỳ** cho tỷ lệ
 * giữ chân.
 */
export function customerFlow(contracts: ContractSpan[], p: Period) {
  const approved = contracts.filter((c) => c.approvedOn);
  const firstApproved = approved
    .map((c) => c.approvedOn!)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const activeAtStart = approved.some((c) => effectiveOn(c, p.from));
  const activeAtEnd = approved.some((c) => effectiveOn(c, p.to));
  const lastEnd = approved.some((c) => !c.endDate)
    ? null
    : approved
        .map((c) => c.endDate!)
        .sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    isNew: inPeriod(firstApproved ?? null, p),
    stopped: !activeAtEnd && inPeriod(lastEnd ?? null, p),
    stoppedOn: !activeAtEnd && inPeriod(lastEnd ?? null, p) ? lastEnd : null,
    firstApprovedOn: firstApproved ?? null,
    activeAtStart,
    activeAtEnd,
  };
}

/** Nhóm số liệu M6: tổng, theo tháng của hạn, theo khách hàng (khách nhiều trễ / quá hạn lên trước). */
export function groupCompliance(
  items: {
    dueDate: Date;
    customer: { id: string; name: string };
    outcome: ComplianceOutcome;
    clientDelay: boolean;
  }[],
) {
  const total = emptyCounts();
  const byMonth = new Map<string, ComplianceCounts>();
  const byCustomer = new Map<string, ComplianceCounts & { name: string }>();
  for (const i of items) {
    addOutcome(total, i.outcome, i.clientDelay);
    const month = i.dueDate.toISOString().slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, emptyCounts());
    addOutcome(byMonth.get(month)!, i.outcome, i.clientDelay);
    if (!byCustomer.has(i.customer.id))
      byCustomer.set(i.customer.id, {
        ...emptyCounts(),
        name: i.customer.name,
      });
    addOutcome(byCustomer.get(i.customer.id)!, i.outcome, i.clientDelay);
  }
  return {
    summary: { ...total, onTimeRate: onTimeRate(total) },
    byMonth: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, c]) => ({ month, ...c, onTimeRate: onTimeRate(c) })),
    byCustomer: [...byCustomer.entries()]
      .map(([customerId, c]) => ({
        customerId,
        ...c,
        onTimeRate: onTimeRate(c),
      }))
      .sort(
        (a, b) =>
          b.late + b.overdue - (a.late + a.overdue) ||
          a.name.localeCompare(b.name),
      ),
  };
}

/**
 * M7: nhóm của một HĐ trong kỳ — NEW (duyệt trong kỳ), ACTIVE (hiệu lực cuối kỳ), EXPIRING (kết thúc
 * trong `expiringDays` ngày sau cuối kỳ, chưa tái ký), ENDED (kết thúc trong kỳ), RENEWED (kết thúc trong
 * kỳ và có HĐ tái ký còn hiệu lực).
 */
export function contractCategories(
  c: ContractSpan,
  renewed: boolean,
  p: Period,
  expiringDays: number,
): string[] {
  const ended = inPeriod(c.endDate, p);
  const expiringUntil = new Date(p.to.getTime() + expiringDays * DAY_MS);
  return [
    inPeriod(c.approvedOn, p) ? 'NEW' : null,
    effectiveOn(c, p.to) ? 'ACTIVE' : null,
    c.endDate && c.endDate > p.to && c.endDate <= expiringUntil && !renewed
      ? 'EXPIRING'
      : null,
    ended ? 'ENDED' : null,
    ended && renewed ? 'RENEWED' : null,
  ].filter((x): x is string => !!x);
}
