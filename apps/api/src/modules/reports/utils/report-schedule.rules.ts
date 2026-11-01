import { ReportScheduleFrequency } from '@prisma/client';

/**
 * Lịch gửi báo cáo định kỳ (đặc tả 10-F, M12): hằng tuần thứ 2 / hằng tháng ngày 1, 07:30 giờ VN.
 * Khoá lượt gửi là ngày gửi (ngày nghiệp vụ 00:00 UTC theo lịch VN). Không đọc DB.
 */

const DAY = 86_400_000;
const VN_OFFSET = 7 * 3_600_000;
const SEND_AT_MINUTES = 7 * 60 + 30;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Ngày gửi gần nhất (kể cả hôm nay) theo tần suất, tính theo lịch VN. */
export function scheduleKey(
  frequency: ReportScheduleFrequency,
  now: Date,
): Date {
  const vn = new Date(now.getTime() + VN_OFFSET);
  const today = Date.UTC(
    vn.getUTCFullYear(),
    vn.getUTCMonth(),
    vn.getUTCDate(),
  );
  if (frequency === ReportScheduleFrequency.MONTHLY)
    return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1));
  // getUTCDay: 0 = Chủ nhật → lùi 6 ngày về thứ 2.
  const sinceMonday = (vn.getUTCDay() + 6) % 7;
  return new Date(today - sinceMonday * DAY);
}

/** Thời điểm gửi của một khoá: 07:30 giờ VN ngày đó. */
export const sendMoment = (key: Date) =>
  new Date(key.getTime() + SEND_AT_MINUTES * 60_000 - VN_OFFSET);

/**
 * Đã đến lượt chưa: đã qua 07:30 ngày gửi (máy dừng lúc đó thì gửi bù khi chạy lại) và mốc gửi không
 * trước lúc bật lịch (bật giữa tuần không gửi ngay).
 */
export function scheduleDue(
  frequency: ReportScheduleFrequency,
  activeFrom: Date,
  now: Date,
): Date | null {
  const key = scheduleKey(frequency, now);
  const at = sendMoment(key);
  return now >= at && at >= activeFrom ? key : null;
}

/** Kỳ số liệu của lượt gửi: tuần trước (thứ 2 – Chủ nhật) hoặc tháng trước; kỳ lưu trong bộ lọc không dùng. */
export function schedulePeriod(
  frequency: ReportScheduleFrequency,
  key: Date,
): { from: string; to: string } {
  if (frequency === ReportScheduleFrequency.MONTHLY)
    return {
      from: iso(
        new Date(Date.UTC(key.getUTCFullYear(), key.getUTCMonth() - 1, 1)),
      ),
      to: iso(new Date(key.getTime() - DAY)),
    };
  return {
    from: iso(new Date(key.getTime() - 7 * DAY)),
    to: iso(new Date(key.getTime() - DAY)),
  };
}
