import { NotificationKind, NotificationSeverity } from '@prisma/client';

/**
 * Quy tắc thuần của nhắc việc theo lịch (đặc tả 06, I9–I13). Ngày nghiệp vụ 00:00 UTC theo lịch VN.
 */

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

/** Mốc bỏ lỡ quá số ngày này thì không gửi bù (tránh dồn nhắc khi mới bật hoặc máy tắt lâu). */
export const CATCH_UP_DAYS = 7;
/** SLA soát xét (G7) và số ngày làm việc thêm trước khi báo quản lý (I13). */
export const REVIEW_SLA_DAYS = 2;
export const REVIEW_ESCALATION_EXTRA_DAYS = 2;
/** Thử lại email sau 1, 5, 15, 60, 240 phút; hết 5 lần → Thất bại (I12). */
export const RETRY_MINUTES = [1, 5, 15, 60, 240];
export const MAX_ATTEMPTS = RETRY_MINUTES.length;

export interface Milestone {
  key: string;
  /** Số ngày so với hạn (âm = trước hạn). */
  offset: number;
  kind: NotificationKind;
  severity: NotificationSeverity;
  label: string;
  /** I10: email cho mốc gần nhất trước hạn, đúng hạn và quá hạn. */
  email: boolean;
}

const LABELS = ['Sắp đến hạn', 'Cần ưu tiên', 'Gần đến hạn'];

/** Mốc theo ngưỡng mức gấp (I9/I11): trước N ngày ×3, đúng hạn, quá hạn +1 ngày. */
export function milestones(thresholds: number[]): Milestone[] {
  const before = thresholds.map((days, i): Milestone => ({
    key: `D-${days}`,
    offset: -days,
    kind: NotificationKind.DUE_REMINDER,
    severity:
      i === 0 ? NotificationSeverity.INFO : NotificationSeverity.WARNING,
    label: LABELS[i] ?? 'Sắp đến hạn',
    email: i === thresholds.length - 1,
  }));
  return [
    ...before,
    {
      key: 'D0',
      offset: 0,
      kind: NotificationKind.DUE_REMINDER,
      severity: NotificationSeverity.WARNING,
      label: 'Đến hạn hôm nay',
      email: true,
    },
    {
      key: 'D+1',
      offset: 1,
      kind: NotificationKind.OVERDUE,
      severity: NotificationSeverity.DANGER,
      label: 'Quá hạn',
      email: true,
    },
  ];
}

/**
 * Mốc cần gửi hôm nay: mốc muộn nhất đã tới (ngày mốc ≤ hôm nay) và chưa quá cửa sổ gửi bù — nên
 * khi bỏ lỡ nhiều mốc chỉ gửi mốc gần nhất, không dồn 7/3/1 một lúc.
 */
export function currentMilestone(
  due: Date,
  today: Date,
  thresholds: number[],
): Milestone | null {
  const reached = milestones(thresholds).filter((m) => {
    const date = due.getTime() + m.offset * DAY_MS;
    return (
      date <= today.getTime() &&
      date >= today.getTime() - CATCH_UP_DAYS * DAY_MS
    );
  });
  return reached.at(-1) ?? null;
}

/** Giờ VN hiện tại đã tới giờ gửi 'HH:mm' chưa. */
export function sendTimeReached(now: Date, sendTime: string): boolean {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const [h, m] = sendTime.split(':').map(Number);
  return vn.getUTCHours() * 60 + vn.getUTCMinutes() >= h * 60 + m;
}

export function retryAt(now: Date, attempts: number): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + RETRY_MINUTES[attempts - 1] * 60_000);
}

export const fmtDate = (date: Date) => {
  const iso = date.toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
};

/** Tiêu đề nhắc: "Gần đến hạn (còn 1 ngày): <việc> — <KH>, hạn dd/MM/yyyy". */
export function reminderTitle(
  m: Milestone,
  subject: string,
  due: Date,
): string {
  const when = m.offset < 0 ? ` (còn ${-m.offset} ngày)` : '';
  return `${m.label}${when}: ${subject}, hạn ${fmtDate(due)}`;
}
