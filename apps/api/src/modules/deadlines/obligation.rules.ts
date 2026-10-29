import {
  HolidayShift,
  ObligationCycle,
  ObligationDueRule,
} from '@prisma/client';
import {
  nextWorkingDayIn,
  previousWorkingDayIn,
  type WorkingCalendar,
} from '../../common/working-calendar';

/**
 * Quy tắc thuần của loại nghĩa vụ pháp lý (đặc tả 06, I1–I5). Ngày nghiệp vụ là Date 00:00 UTC.
 * Kỳ: tháng 'YYYY-MM', quý 'YYYY-Qn' (quý dương lịch), năm 'YYYY' = năm kết thúc năm tài chính.
 */

export interface DueRuleInput {
  dueRule: ObligationDueRule;
  monthsAfter: number | null;
  dueMonth: number | null;
  dueDay: number;
  useFiscalYear: boolean;
  holidayShift: HolidayShift;
}

export const CONDITION_FIELDS = {
  taxPeriod: ['MONTHLY', 'QUARTERLY'],
  vatMethod: ['DEDUCTION', 'DIRECT', 'NONE'],
  pitPeriod: ['MONTHLY', 'QUARTERLY', 'NONE'],
  accountingRegime: ['TT200', 'TT133', 'OTHER'],
} as const;

export type ConditionField = keyof typeof CONDITION_FIELDS;
export type ObligationConditions = Partial<Record<ConditionField, string[]>>;

export interface CustomerTaxProfile {
  taxPeriod: string;
  vatMethod: string | null;
  pitPeriod: string | null;
  accountingRegime: string | null;
  fiscalYearEndMonth: number;
}

const utc = (year: number, month0: number, day: number) =>
  new Date(Date.UTC(year, month0, day));

/** Ngày cuối của tháng (month0 có thể vượt 0–11, tự quy đổi năm). */
function lastDayOfMonth(year: number, month0: number): Date {
  return utc(year, month0 + 1, 0);
}

function clampDay(year: number, month0: number, day: number): Date {
  const last = lastDayOfMonth(year, month0);
  return utc(
    last.getUTCFullYear(),
    last.getUTCMonth(),
    Math.min(day, last.getUTCDate()),
  );
}

const fyEnd = (useFiscalYear: boolean, fiscalYearEndMonth: number) =>
  useFiscalYear ? fiscalYearEndMonth : 12;

/** Ngày cuối kỳ của nghĩa vụ. */
export function periodEndOf(
  cycle: ObligationCycle,
  period: string,
  fiscalYearEndMonth = 12,
): Date {
  const year = Number(period.slice(0, 4));
  if (cycle === ObligationCycle.MONTHLY)
    return lastDayOfMonth(year, Number(period.slice(5, 7)) - 1);
  if (cycle === ObligationCycle.QUARTERLY)
    return lastDayOfMonth(year, Number(period.slice(6)) * 3 - 1);
  return lastDayOfMonth(year, fiscalYearEndMonth - 1);
}

/** Ngày đầu kỳ (ngày sau cuối kỳ trước). */
export function periodStartOf(
  cycle: ObligationCycle,
  period: string,
  fiscalYearEndMonth = 12,
): Date {
  const end = periodEndOf(cycle, period, fiscalYearEndMonth);
  const months =
    cycle === ObligationCycle.MONTHLY
      ? 1
      : cycle === ObligationCycle.QUARTERLY
        ? 3
        : 12;
  return utc(end.getUTCFullYear(), end.getUTCMonth() - months + 1, 1);
}

/** Kỳ chứa một ngày. */
export function periodContaining(
  cycle: ObligationCycle,
  date: Date,
  fiscalYearEndMonth = 12,
): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (cycle === ObligationCycle.MONTHLY)
    return `${year}-${String(month).padStart(2, '0')}`;
  if (cycle === ObligationCycle.QUARTERLY)
    return `${year}-Q${Math.ceil(month / 3)}`;
  return String(month <= fiscalYearEndMonth ? year : year + 1);
}

/** Các kỳ có ngày cuối kỳ nằm trong [from, to]. */
export function periodsEndingBetween(
  cycle: ObligationCycle,
  from: Date,
  to: Date,
  fiscalYearEndMonth = 12,
): string[] {
  const periods: string[] = [];
  let month = utc(from.getUTCFullYear(), from.getUTCMonth(), 1);
  while (month <= to) {
    const end = lastDayOfMonth(month.getUTCFullYear(), month.getUTCMonth());
    const m = end.getUTCMonth() + 1;
    const isEnd =
      cycle === ObligationCycle.MONTHLY ||
      (cycle === ObligationCycle.QUARTERLY && m % 3 === 0) ||
      (cycle === ObligationCycle.YEARLY && m === fiscalYearEndMonth);
    if (isEnd && end >= from && end <= to)
      periods.push(periodContaining(cycle, end, fiscalYearEndMonth));
    month = utc(month.getUTCFullYear(), month.getUTCMonth() + 1, 1);
  }
  return periods;
}

/** Hạn theo quy tắc, chưa dời ngày nghỉ. */
export function rawDueDate(
  rule: DueRuleInput,
  period: string,
  periodEnd: Date,
): Date {
  if (rule.dueRule === ObligationDueRule.FIXED_IN_YEAR)
    return clampDay(
      Number(period.slice(0, 4)),
      (rule.dueMonth ?? 1) - 1,
      rule.dueDay,
    );
  return clampDay(
    periodEnd.getUTCFullYear(),
    periodEnd.getUTCMonth() + (rule.monthsAfter ?? 0),
    rule.dueDay,
  );
}

/** Hạn pháp lý của kỳ: theo quy tắc rồi dời khi trùng ngày nghỉ (I3). */
export function statutoryDueDate(
  rule: DueRuleInput,
  period: string,
  periodEnd: Date,
  calendar: WorkingCalendar,
): Date {
  const raw = rawDueDate(rule, period, periodEnd);
  return rule.holidayShift === HolidayShift.PREVIOUS
    ? previousWorkingDayIn(calendar, raw)
    : nextWorkingDayIn(calendar, raw);
}

export function obligationPeriodEnd(
  cycle: ObligationCycle,
  period: string,
  rule: Pick<DueRuleInput, 'useFiscalYear'>,
  profile: Pick<CustomerTaxProfile, 'fiscalYearEndMonth'>,
): Date {
  return periodEndOf(
    cycle,
    period,
    fyEnd(rule.useFiscalYear, profile.fiscalYearEndMonth),
  );
}

/**
 * Kỳ nghĩa vụ mà việc của kỳ `taskPeriod` phục vụ: kỳ chứa ngày cuối kỳ của việc và kết thúc cùng
 * ngày (việc tháng 2 không gắn nghĩa vụ quý 1). Việc theo năm gắn nghĩa vụ năm cùng nhãn năm.
 */
export function obligationPeriodForTask(
  cycle: ObligationCycle,
  taskPeriod: string,
  taskPeriodEnd: Date,
  fiscalYearEndMonth: number,
): string | null {
  if (cycle === ObligationCycle.YEARLY && /^\d{4}$/.test(taskPeriod))
    return taskPeriod;
  const period = periodContaining(cycle, taskPeriodEnd, fiscalYearEndMonth);
  const end = periodEndOf(cycle, period, fiscalYearEndMonth);
  return end.getTime() === taskPeriodEnd.getTime() ? period : null;
}

/** Hồ sơ khách hàng thoả điều kiện; trường để trống ở khách hàng không thoả điều kiện có liệt kê. */
export function matchesConditions(
  conditions: ObligationConditions,
  profile: CustomerTaxProfile,
): boolean {
  return (Object.keys(conditions) as ConditionField[]).every((field) => {
    const allowed = conditions[field];
    if (!allowed || allowed.length === 0) return true;
    const value = profile[field];
    return value != null && allowed.includes(value);
  });
}

/** Đọc điều kiện từ JSON; trả chuỗi lỗi khi trường/giá trị lạ. */
export function parseConditions(value: unknown): ObligationConditions | string {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value))
    return 'Điều kiện áp dụng không hợp lệ';
  const result: ObligationConditions = {};
  for (const [field, list] of Object.entries(value)) {
    if (!(field in CONDITION_FIELDS))
      return `Điều kiện áp dụng có trường lạ: ${field}`;
    const allowed: readonly string[] =
      CONDITION_FIELDS[field as ConditionField];
    if (
      !Array.isArray(list) ||
      list.some((v) => typeof v !== 'string' || !allowed.includes(v))
    )
      return `Điều kiện ${field} có giá trị không hợp lệ`;
    if (list.length > 0)
      result[field as ConditionField] = [...new Set(list as string[])];
  }
  return result;
}

/** Lỗi của quy tắc hạn; null khi hợp lệ. */
export function dueRuleError(
  cycle: ObligationCycle,
  rule: DueRuleInput,
): string | null {
  if (!Number.isInteger(rule.dueDay) || rule.dueDay < 1 || rule.dueDay > 31)
    return 'Ngày hạn phải từ 1 đến 31 (31 = ngày cuối tháng)';
  if (rule.dueRule === ObligationDueRule.MONTH_AFTER_END) {
    const k = rule.monthsAfter;
    if (k == null || !Number.isInteger(k) || k < 0 || k > 24)
      return 'Số tháng sau cuối kỳ phải từ 0 đến 24';
    return null;
  }
  if (cycle !== ObligationCycle.YEARLY)
    return 'Hạn ngày cố định trong năm chỉ dùng cho nghĩa vụ theo năm';
  const m = rule.dueMonth;
  if (m == null || !Number.isInteger(m) || m < 1 || m > 12)
    return 'Tháng hạn phải từ 1 đến 12';
  return null;
}

/** Phiên bản đã xác nhận áp cho kỳ: bản mới nhất có ngày hiệu lực ≤ ngày cuối kỳ. */
export function versionForPeriod<
  T extends { effectiveFrom: Date; versionNo: number },
>(confirmed: T[], periodEnd: Date): T | null {
  return (
    confirmed
      .filter((v) => v.effectiveFrom <= periodEnd)
      .sort(
        (a, b) =>
          b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
          b.versionNo - a.versionNo,
      )[0] ?? null
  );
}

/** Phiên bản đã xác nhận có ngày hiệu lực muộn nhất. */
export function latestVersion<
  T extends { effectiveFrom: Date; versionNo: number },
>(confirmed: T[]): T | null {
  return versionForPeriod(confirmed, new Date(8.64e15));
}
