import {
  outcome,
  Outcome,
  ratePercent,
} from '../../contracts/audit-engagements/deadline.rules';

/**
 * Quy tắc thuần của báo cáo Đánh giá năng lực (đặc tả 10-E; khung G1–G10, `10-performance-evaluation.md`).
 * Ngày nghiệp vụ 00:00 UTC theo lịch VN. Không đọc DB.
 */

const DAY = 86_400_000;
const VN_OFFSET = 7 * 3_600_000;

export const vnDayOf = (at: Date) => {
  const local = new Date(at.getTime() + VN_OFFSET);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  );
};

/** Khoảng chờ khách đã được trưởng nhóm xác nhận (G5). */
export interface WaitSpan {
  startedAt: Date;
  endedAt: Date | null;
}

/** G5: số ngày chờ khách (tính theo ngày VN, khoảng chồng nhau gộp một lần, đang chờ tính tới hôm nay). */
export function clientWaitDays(waits: WaitSpan[], today: Date): number {
  const days = new Set<number>();
  for (const w of waits) {
    const from = vnDayOf(w.startedAt).getTime();
    const to = w.endedAt ? vnDayOf(w.endedAt).getTime() : today.getTime();
    for (let t = from; t < to; t += DAY) days.add(t);
  }
  return days.size;
}

/** Dữ liệu một việc để đánh giá trợ lý (G2, G4–G6). */
export interface TaskFacts {
  dueDate: Date;
  originalDueDate: Date;
  isStatutory: boolean;
  reviewLevels: number;
  firstSubmittedAt: Date | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
  legacy: boolean;
  returnCount: number;
  waits: WaitSpan[];
}

/**
 * G4: mốc đạt của trợ lý = lần nộp đầu; việc không cần soát xét thì lúc được chấp nhận / hoàn thành.
 * Việc chuyển đổi thiếu mốc → null và không tính đúng hạn (H9).
 */
export function assistantMilestone(t: TaskFacts): Date | null {
  return (
    t.firstSubmittedAt ??
    (t.reviewLevels === 0 ? (t.acceptedAt ?? t.completedAt) : null)
  );
}

/**
 * Kết quả một việc của trợ lý: hạn hiện hành (+ số ngày chờ khách nếu không phải hạn pháp lý — G5) và
 * hạn gốc (G2). `counted = false` với dữ liệu chuyển đổi thiếu mốc.
 */
export function assistantOutcome(t: TaskFacts, today: Date) {
  const milestone = assistantMilestone(t);
  const counted = !(t.legacy && !milestone);
  const wait = clientWaitDays(t.waits, today);
  const allowance = t.isStatutory ? 0 : wait;
  const current = outcome(
    new Date(t.dueDate.getTime() + allowance * DAY),
    milestone,
    today,
  );
  const original = outcome(t.originalDueDate, milestone, today);
  return {
    counted,
    milestone,
    waitDays: wait,
    current,
    original,
    /** Trễ hạn pháp lý (G6): luôn tính, kể cả do khách (gắn nhãn). */
    statutoryLate: t.isStatutory && isLate(current),
    clientDelay: wait > 0 && isLate(outcome(t.dueDate, milestone, today)),
  };
}

export const isLate = (o: Outcome) =>
  o.result === 'LATE' || o.result === 'OVERDUE';

/** Tỷ lệ đúng hạn: đúng hạn / (đúng hạn + trễ + quá hạn chưa đạt) — sắp / chưa đến hạn không vào mẫu số. */
export function onTimeRate(outcomes: Outcome[]): number | null {
  const onTime = outcomes.filter((o) => o.result === 'ON_TIME').length;
  const due = outcomes.filter(
    (o) => o.result === 'ON_TIME' || isLate(o),
  ).length;
  return ratePercent(onTime, due);
}

/** Một việc trong kỳ dịch vụ (dòng dịch vụ × kỳ). */
export interface PeriodTask {
  dueDate: Date;
  originalDueDate: Date;
  isStatutory: boolean;
  status: string;
  acceptedAt: Date | null;
  completedAt: Date | null;
  extensions: number;
  waits: WaitSpan[];
}

/**
 * Kỳ dịch vụ (khung G, "Đơn vị đo"): hạn = hạn muộn nhất của các việc (gốc / hiện hành); đạt khi mọi việc
 * được chấp nhận / hoàn thành (lúc việc cuối cùng đạt); có hạn pháp lý thì không cộng ngày chờ khách.
 */
export function periodOutcome(tasks: PeriodTask[], today: Date) {
  const max = (pick: (t: PeriodTask) => number) => Math.max(...tasks.map(pick));
  const due = new Date(max((t) => t.dueDate.getTime()));
  const original = new Date(max((t) => t.originalDueDate.getTime()));
  const done = tasks.every(
    (t) => t.status === 'COMPLETED' || t.status === 'APPROVED',
  );
  const reachedAt = done
    ? new Date(
        max((t) => (t.acceptedAt ?? t.completedAt ?? new Date(0)).getTime()),
      )
    : null;
  const statutory = tasks.some((t) => t.isStatutory);
  const wait = statutory
    ? 0
    : clientWaitDays(
        tasks.flatMap((t) => t.waits),
        today,
      );
  const current = outcome(
    new Date(due.getTime() + wait * DAY),
    reachedAt,
    today,
  );
  return {
    due,
    original,
    reachedAt,
    statutory,
    waitDays: wait,
    current,
    originalOutcome: outcome(original, reachedAt, today),
    extended: tasks.some((t) => t.extensions > 0),
    statutoryLate: statutory && isLate(current),
  };
}

/** Thời điểm xác định người giữ vai (như F10): hết ngày hạn; đạt sớm hơn thì lúc đạt; chưa tới hạn thì bây giờ. */
export function momentOf(due: Date, reachedAt: Date | null, now: Date): Date {
  const dueEnd = due.getTime() + DAY - VN_OFFSET - 1;
  return new Date(
    Math.min(dueEnd, now.getTime(), reachedAt?.getTime() ?? Infinity),
  );
}

export interface HeldSpan<R extends string> {
  role: R;
  userId: string;
  fromAt: Date;
  toAt: Date | null;
}

/** Người giữ vai `role` tại thời điểm `at` (G1, lịch sử vai). */
export function holderAt<R extends string>(
  spans: HeldSpan<R>[],
  role: R,
  at: Date,
): string[] {
  return spans
    .filter(
      (s) => s.role === role && s.fromAt <= at && (!s.toAt || s.toAt > at),
    )
    .map((s) => s.userId);
}

export { ratePercent };
