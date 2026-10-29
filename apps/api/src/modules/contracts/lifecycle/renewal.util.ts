/** Dời kỳ sang năm sau: 2025 → 2026, 2025-10 → 2026-10, 2025-Q3 → 2026-Q3; kỳ khác giữ nguyên. */
export function shiftPeriod(period: string | null, years = 1): string | null {
  const match = period?.match(/^(\d{4})(-(0[1-9]|1[0-2]|Q[1-4]))?$/);
  if (!period || !match) return period;
  return `${Number(match[1]) + years}${match[2] ?? ''}`;
}

/** Cộng năm cho ngày nghiệp vụ (UTC 00:00); 29/02 sang năm không nhuận thành 28/02. */
export function addYears(date: Date, years = 1): Date {
  const year = date.getUTCFullYear() + years;
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

/** Ngày nghiệp vụ hôm nay theo giờ Việt Nam (UTC 00:00). */
export function vietnamToday(now = new Date()): Date {
  const local = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
