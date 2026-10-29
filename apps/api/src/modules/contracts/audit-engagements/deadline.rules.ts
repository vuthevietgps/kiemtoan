import { AuditDeadlineKind, AuditRole, AuditStage } from '@prisma/client';

const { FIELDWORK_END, REVIEW_END, REPORT_ISSUE } = AuditDeadlineKind;
const DAY = 86_400_000;
const VN_OFFSET = 7 * 3_600_000;

export const DEADLINE_KINDS: readonly AuditDeadlineKind[] = [
  FIELDWORK_END,
  REVIEW_END,
  REPORT_ISSUE,
];

/** Giai đoạn mà hồ sơ tới lần đầu thì đạt mốc (04-F2). */
export const ACHIEVED_ON: Record<AuditDeadlineKind, AuditStage> = {
  FIELDWORK_END: AuditStage.REVIEW,
  REVIEW_END: AuditStage.AWAITING_ISSUE,
  REPORT_ISSUE: AuditStage.ISSUED,
};

/** Vai chịu trách nhiệm từng hạn (F10); trợ lý không bị tính theo hạn hồ sơ. */
export const RESPONSIBLE_ROLES: Record<AuditDeadlineKind, AuditRole[]> = {
  FIELDWORK_END: [AuditRole.MANAGER, AuditRole.LEAD],
  REVIEW_END: [AuditRole.SIGNER1, AuditRole.MANAGER],
  REPORT_ISSUE: [AuditRole.MANAGER, AuditRole.LEAD],
};

/** Ngưỡng "sắp đến hạn" (11 sẽ đưa vào Cài đặt). */
export const DUE_SOON_DAYS = 7;

export type DeadlineResult =
  'ON_TIME' | 'LATE' | 'OVERDUE' | 'DUE_SOON' | 'PENDING';

export interface Outcome {
  result: DeadlineResult;
  /** Số ngày trễ (LATE), quá hạn (OVERDUE) hoặc còn lại (DUE_SOON, PENDING); 0 khi đúng hạn. */
  days: number;
}

/** Ngày nghiệp vụ (UTC 00:00) theo giờ Việt Nam của một thời điểm. */
export function vnDay(at: Date): Date {
  const local = new Date(at.getTime() + VN_OFFSET);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  );
}

const daysBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / DAY);

/** Kết quả một hạn: đạt đúng ngày hạn (giờ VN) vẫn là đúng hạn. */
export function outcome(
  due: Date,
  achievedAt: Date | null,
  today: Date,
): Outcome {
  if (achievedAt) {
    const late = daysBetween(due, vnDay(achievedAt));
    return late > 0
      ? { result: 'LATE', days: late }
      : { result: 'ON_TIME', days: 0 };
  }
  const left = daysBetween(today, due);
  if (left < 0) return { result: 'OVERDUE', days: -left };
  return { result: left <= DUE_SOON_DAYS ? 'DUE_SOON' : 'PENDING', days: left };
}

export interface DeadlineFacts {
  kind: AuditDeadlineKind;
  originalDue: Date;
  currentDue: Date;
  achievedAt: Date | null;
}

export function evaluateDeadline(d: DeadlineFacts, today: Date) {
  return {
    current: outcome(d.currentDue, d.achievedAt, today),
    original: outcome(d.originalDue, d.achievedAt, today),
    extended: d.currentDue.getTime() !== d.originalDue.getTime(),
  };
}

/**
 * Thời điểm xác định người chịu trách nhiệm (F10): người giữ vai lúc hạn đến (cuối ngày hạn giờ VN);
 * đạt sớm hơn thì lúc đạt; hạn chưa tới thì người đang giữ vai.
 */
export function responsibilityMoment(
  currentDue: Date,
  achievedAt: Date | null,
  now: Date,
): Date {
  const dueEnd = new Date(currentDue.getTime() + DAY - VN_OFFSET - 1);
  const candidates = [dueEnd.getTime(), now.getTime()];
  if (achievedAt) candidates.push(achievedAt.getTime());
  return new Date(Math.min(...candidates));
}

export interface RoleSpan {
  role: AuditRole;
  userId: string;
  fromAt: Date;
  toAt: Date | null;
}

/** Người giữ các vai `roles` tại thời điểm `at`; một người giữ hai vai chỉ tính một lần. */
export function holdersAt(
  history: RoleSpan[],
  roles: AuditRole[],
  at: Date,
): Map<string, AuditRole[]> {
  const holders = new Map<string, AuditRole[]>();
  for (const span of history) {
    if (!roles.includes(span.role)) continue;
    if (span.fromAt > at || (span.toAt && span.toAt <= at)) continue;
    holders.set(span.userId, [...(holders.get(span.userId) ?? []), span.role]);
  }
  return holders;
}

/** Tỷ lệ % làm tròn 1 chữ số; không có mẫu thì null (giao diện hiện "—"). */
export function ratePercent(hit: number, total: number): number | null {
  return total ? Math.round((hit / total) * 1000) / 10 : null;
}

export interface CountedDeadline {
  current: Outcome;
  original: Outcome;
  extensions: number;
}

/** Tổng hợp đúng hạn của một người: chỉ hạn đã đạt hoặc đã quá hạn vào mẫu số. */
export function summarize(rows: CountedDeadline[]) {
  const count = (
    pick: (r: CountedDeadline) => Outcome,
    result: DeadlineResult,
  ) => rows.filter((r) => pick(r).result === result).length;
  const due = (pick: (r: CountedDeadline) => Outcome) =>
    count(pick, 'ON_TIME') + count(pick, 'LATE') + count(pick, 'OVERDUE');
  const lateDays = rows
    .filter((r) => r.current.result === 'LATE')
    .map((r) => r.current.days);
  return {
    total: rows.length,
    onTime: count((r) => r.current, 'ON_TIME'),
    late: count((r) => r.current, 'LATE'),
    overdue: count((r) => r.current, 'OVERDUE'),
    dueSoon: count((r) => r.current, 'DUE_SOON'),
    rate: ratePercent(
      count((r) => r.current, 'ON_TIME'),
      due((r) => r.current),
    ),
    onTimeOriginal: count((r) => r.original, 'ON_TIME'),
    rateOriginal: ratePercent(
      count((r) => r.original, 'ON_TIME'),
      due((r) => r.original),
    ),
    extensions: rows.reduce((sum, r) => sum + r.extensions, 0),
    avgLateDays: lateDays.length
      ? Math.round(
          (lateDays.reduce((a, b) => a + b, 0) / lateDays.length) * 10,
        ) / 10
      : null,
  };
}

/** Hạn phải theo thứ tự: kết thúc kiểm toán ≤ hoàn tất soát xét ≤ phát hành. */
export function deadlineOrderError(
  dues: Partial<Record<AuditDeadlineKind, Date | null>>,
): string | null {
  const ordered = DEADLINE_KINDS.map((k) => dues[k]).filter(
    (d): d is Date => !!d,
  );
  for (let i = 1; i < ordered.length; i++)
    if (ordered[i] < ordered[i - 1])
      return 'Hạn phải theo thứ tự: kết thúc kiểm toán ≤ hoàn tất soát xét ≤ phát hành';
  return null;
}
