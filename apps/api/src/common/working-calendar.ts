/**
 * Lịch làm việc (đặc tả 06, I2). Ngày nghiệp vụ là Date 00:00 UTC như cột `date`.
 * Năm đã xác nhận: thứ 2–6, trừ ngày nghỉ (lễ, Tết, nghỉ bù), cộng ngày làm bù.
 * Năm chưa xác nhận: thứ 2–6 như trước 06.
 */
export interface WorkingCalendar {
  isWorkingDay(date: Date): boolean;
  /** Năm của ngày đã được xác nhận lịch (chỉ khi đó mới dời hạn nội bộ theo I3). */
  isConfirmed(date: Date): boolean;
}

const DAY_MS = 86_400_000;

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export const WEEKDAY_CALENDAR: WorkingCalendar = {
  isWorkingDay: isWeekday,
  isConfirmed: () => false,
};

export interface CalendarData {
  confirmedYears: number[];
  days: { date: Date; kind: 'DAY_OFF' | 'WORKDAY' }[];
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** Lịch từ dữ liệu đã xác nhận; ngày của năm chưa xác nhận bị bỏ qua. */
export function buildWorkingCalendar(data: CalendarData): WorkingCalendar {
  const years = new Set(data.confirmedYears);
  const offDays = new Set<string>();
  const workDays = new Set<string>();
  for (const day of data.days) {
    if (!years.has(day.date.getUTCFullYear())) continue;
    (day.kind === 'DAY_OFF' ? offDays : workDays).add(dayKey(day.date));
  }
  return {
    isConfirmed: (date) => years.has(date.getUTCFullYear()),
    isWorkingDay: (date) => {
      const key = dayKey(date);
      if (offDays.has(key)) return false;
      if (workDays.has(key)) return true;
      return isWeekday(date);
    },
  };
}

/** Chính ngày đó nếu là ngày làm việc, nếu không thì ngày làm việc kế tiếp. */
export function nextWorkingDayIn(calendar: WorkingCalendar, date: Date): Date {
  let current = date;
  while (!calendar.isWorkingDay(current))
    current = new Date(current.getTime() + DAY_MS);
  return current;
}

/** Chính ngày đó nếu là ngày làm việc, nếu không thì ngày làm việc liền trước. */
export function previousWorkingDayIn(
  calendar: WorkingCalendar,
  date: Date,
): Date {
  let current = date;
  while (!calendar.isWorkingDay(current))
    current = new Date(current.getTime() - DAY_MS);
  return current;
}
