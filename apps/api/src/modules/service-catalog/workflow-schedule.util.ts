import { WorkflowScheduleMode } from '@prisma/client';
import {
  nextWorkingDayIn,
  previousWorkingDayIn,
  WEEKDAY_CALENDAR,
  type WorkingCalendar,
} from '../../common/working-calendar';

/**
 * Lập lịch bước quy trình (đặc tả 03-B). Ngày nghiệp vụ là Date 00:00 UTC như cột `date`.
 * Ngày làm việc theo lịch 06 (I2) khi truyền `calendar`; mặc định thứ 2–6 như trước.
 */

const DAY_MS = 86_400_000;

/** Ngày cuối kỳ (UTC 00:00). Hỗ trợ 'YYYY-MM', 'YYYY-Qn' và 'YYYY'. */
export function endOfPeriod(period: string): Date {
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) {
    return new Date(Date.UTC(Number(month[1]), Number(month[2]), 0));
  }
  const quarter = /^(\d{4})-Q([1-4])$/i.exec(period);
  if (quarter) {
    return new Date(Date.UTC(Number(quarter[1]), Number(quarter[2]) * 3, 0));
  }
  const year = /^(\d{4})$/.exec(period);
  if (year) return new Date(Date.UTC(Number(year[1]), 11, 31));
  throw new Error(`Kỳ không hợp lệ: ${period}`);
}

/**
 * Hạn theo kỳ = ngày cuối kỳ + số ngày lệch (ngày lịch). I3: năm đã xác nhận lịch thì hạn rơi vào
 * ngày nghỉ lùi về ngày làm việc trước, để không sát hạn pháp lý.
 */
export function computeDueDate(
  period: string,
  dueDayOffset: number,
  calendar: WorkingCalendar = WEEKDAY_CALENDAR,
): Date {
  const due = new Date(endOfPeriod(period).getTime() + dueDayOffset * DAY_MS);
  return calendar.isConfirmed(due) ? previousWorkingDayIn(calendar, due) : due;
}

export function isWorkingDay(
  date: Date,
  calendar: WorkingCalendar = WEEKDAY_CALENDAR,
): boolean {
  return calendar.isWorkingDay(date);
}

/** Chính ngày đó nếu là ngày làm việc, nếu không thì ngày làm việc kế tiếp. */
export function nextWorkingDay(
  date: Date,
  calendar: WorkingCalendar = WEEKDAY_CALENDAR,
): Date {
  return nextWorkingDayIn(calendar, date);
}

/** Tiến `days` ngày làm việc kể từ một ngày làm việc (0 = chính ngày đó). */
export function addWorkingDays(
  start: Date,
  days: number,
  calendar: WorkingCalendar = WEEKDAY_CALENDAR,
): Date {
  let current = nextWorkingDay(start, calendar);
  for (let left = days; left > 0; left--) {
    current = nextWorkingDay(new Date(current.getTime() + DAY_MS), calendar);
  }
  return current;
}

/** Số ngày làm việc trong khoảng [from, to], tính cả hai đầu. */
export function countWorkingDays(
  from: Date,
  to: Date,
  calendar: WorkingCalendar = WEEKDAY_CALENDAR,
): number {
  let count = 0;
  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
    if (calendar.isWorkingDay(new Date(t))) count++;
  }
  return count;
}

export interface SchedulableStep {
  key: string;
  dependsOn: string[];
  durationDays?: number | null;
  dueOffsetDays?: number | null;
}

export interface ScheduledStep {
  key: string;
  /** Ngày bắt đầu dự kiến; null với lập lịch theo kỳ. */
  start: Date | null;
  /** Ngày kết thúc dự kiến (theo dự án) hoặc hạn (theo kỳ). */
  end: Date;
}

export interface Schedule {
  steps: ScheduledStep[];
  /** Tổng số ngày làm việc từ lúc bắt đầu tới bước kết thúc muộn nhất; null với lập lịch theo kỳ. */
  totalWorkingDays: number | null;
}

/** Thứ tự tôpô theo phụ thuộc, giữ thứ tự khai báo khi không ràng buộc. Giả định không có vòng. */
export function topologicalOrder(steps: SchedulableStep[]): string[] {
  const done = new Set<string>();
  const order: string[] = [];
  while (order.length < steps.length) {
    const ready = steps.find(
      (s) => !done.has(s.key) && s.dependsOn.every((d) => done.has(d)),
    );
    if (!ready) throw new Error('Quy trình có vòng phụ thuộc');
    done.add(ready.key);
    order.push(ready.key);
  }
  return order;
}

/**
 * Lịch dự kiến. Theo kỳ: hạn = cuối kỳ + số ngày lệch. Theo dự án: bước không phụ thuộc bắt đầu
 * từ ngày bắt đầu (dời sang ngày làm việc), bước có phụ thuộc bắt đầu ngày làm việc kế tiếp sau
 * bước phụ thuộc kết thúc muộn nhất; kết thúc = bắt đầu + thời lượng − 1 ngày làm việc.
 * Bản nháp thiếu thời lượng được tạm tính 1 ngày.
 */
export function scheduleSteps(
  mode: WorkflowScheduleMode,
  steps: SchedulableStep[],
  options: { startDate: Date; period: string; calendar?: WorkingCalendar },
): Schedule {
  const calendar = options.calendar ?? WEEKDAY_CALENDAR;
  if (mode === WorkflowScheduleMode.PERIODIC) {
    return {
      steps: steps.map((s) => ({
        key: s.key,
        start: null,
        end: computeDueDate(options.period, s.dueOffsetDays ?? 0, calendar),
      })),
      totalWorkingDays: null,
    };
  }
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const ends = new Map<string, Date>();
  const starts = new Map<string, Date>();
  const projectStart = nextWorkingDay(options.startDate, calendar);
  for (const key of topologicalOrder(steps)) {
    const step = byKey.get(key)!;
    const latest = step.dependsOn
      .map((d) => ends.get(d)!.getTime())
      .reduce((max, t) => Math.max(max, t), -Infinity);
    const start =
      latest === -Infinity
        ? projectStart
        : nextWorkingDay(new Date(latest + DAY_MS), calendar);
    starts.set(key, start);
    ends.set(
      key,
      addWorkingDays(start, Math.max(step.durationDays ?? 1, 1) - 1, calendar),
    );
  }
  const lastEnd = Math.max(...[...ends.values()].map((d) => d.getTime()));
  return {
    steps: steps.map((s) => ({
      key: s.key,
      start: starts.get(s.key)!,
      end: ends.get(s.key)!,
    })),
    totalWorkingDays:
      steps.length === 0
        ? 0
        : countWorkingDays(projectStart, new Date(lastEnd), calendar),
  };
}
