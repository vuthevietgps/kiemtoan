import {
  WEEKDAY_CALENDAR,
  type WorkingCalendar,
} from '../../common/working-calendar';
import { countWorkingDays } from '../service-catalog/workflow-schedule.util';

/**
 * SLA soát xét (khung đánh giá G7): 2 ngày làm việc từ lúc việc vào cấp đến lúc chấp nhận/trả lại.
 * Ngày làm việc theo lịch 06 (năm chưa xác nhận: thứ 2–6); ngưỡng cấu hình ở 11.
 */
export const REVIEW_SLA_WORKING_DAYS = 2;

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

/** Ngày (UTC 00:00) theo lịch Việt Nam của một thời điểm. */
export function vietnamDate(at: Date): Date {
  const local = new Date(at.getTime() + VN_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  );
}

/** Số ngày làm việc đã trôi qua kể từ ngày vào cấp (không tính chính ngày đó). */
export function workingDaysWaited(
  enteredAt: Date,
  now: Date = new Date(),
  calendar: WorkingCalendar = WEEKDAY_CALENDAR,
): number {
  const from = new Date(vietnamDate(enteredAt).getTime() + DAY_MS);
  const to = vietnamDate(now);
  return from > to ? 0 : countWorkingDays(from, to, calendar);
}
