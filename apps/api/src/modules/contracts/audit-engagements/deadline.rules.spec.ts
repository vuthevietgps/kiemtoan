import { AuditRole } from '@prisma/client';
import {
  deadlineOrderError,
  evaluateDeadline,
  holdersAt,
  outcome,
  ratePercent,
  responsibilityMoment,
  summarize,
} from './deadline.rules';

const d = (value: string) => new Date(`${value}T00:00:00Z`);
const DUE = d('2026-03-31');
const TODAY = d('2026-03-20');

describe('outcome', () => {
  it('so theo ngày giờ Việt Nam: 23:59 ngày hạn là đúng hạn, 00:00 hôm sau là trễ', () => {
    expect(outcome(DUE, new Date('2026-03-31T16:59:59Z'), TODAY)).toEqual({
      result: 'ON_TIME',
      days: 0,
    });
    expect(outcome(DUE, new Date('2026-03-31T17:00:00Z'), TODAY)).toEqual({
      result: 'LATE',
      days: 1,
    });
  });

  it('chưa đạt: quá hạn, sắp đến hạn (≤ 7 ngày), chưa tới', () => {
    expect(outcome(DUE, null, d('2026-04-03'))).toEqual({
      result: 'OVERDUE',
      days: 3,
    });
    expect(outcome(DUE, null, d('2026-03-31'))).toEqual({
      result: 'DUE_SOON',
      days: 0,
    });
    expect(outcome(DUE, null, d('2026-03-24'))).toMatchObject({
      result: 'DUE_SOON',
    });
    expect(outcome(DUE, null, d('2026-03-23'))).toEqual({
      result: 'PENDING',
      days: 8,
    });
  });

  it('đánh giá cả theo hạn gốc và cờ đã gia hạn', () => {
    const result = evaluateDeadline(
      {
        kind: 'REPORT_ISSUE',
        originalDue: d('2026-03-25'),
        currentDue: DUE,
        achievedAt: new Date('2026-03-28T03:00:00Z'),
      },
      TODAY,
    );
    expect(result).toEqual({
      current: { result: 'ON_TIME', days: 0 },
      original: { result: 'LATE', days: 3 },
      extended: true,
    });
  });
});

describe('responsibilityMoment / holdersAt', () => {
  const now = new Date('2026-04-10T05:00:00Z');
  const dueEnd = new Date('2026-03-31T16:59:59.999Z');

  it('lúc đạt nếu sớm hơn, nếu không thì cuối ngày hạn; hạn chưa tới thì bây giờ', () => {
    const early = new Date('2026-03-20T02:00:00Z');
    expect(responsibilityMoment(DUE, early, now)).toEqual(early);
    expect(
      responsibilityMoment(DUE, new Date('2026-04-05T02:00:00Z'), now),
    ).toEqual(dueEnd);
    expect(responsibilityMoment(DUE, null, now)).toEqual(dueEnd);
    const before = new Date('2026-03-15T00:00:00Z');
    expect(responsibilityMoment(DUE, null, before)).toEqual(before);
  });

  it('người giữ vai tại thời điểm, gộp hai vai của cùng một người', () => {
    const at = new Date('2026-03-31T10:00:00Z');
    const history = [
      {
        role: AuditRole.LEAD,
        userId: 'cu',
        fromAt: d('2026-01-01'),
        toAt: d('2026-03-30'),
      },
      {
        role: AuditRole.LEAD,
        userId: 'moi',
        fromAt: d('2026-03-30'),
        toAt: null,
      },
      {
        role: AuditRole.MANAGER,
        userId: 'moi',
        fromAt: d('2026-01-01'),
        toAt: null,
      },
      {
        role: AuditRole.ASSISTANT,
        userId: 'tro-ly',
        fromAt: d('2026-01-01'),
        toAt: null,
      },
    ];
    const holders = holdersAt(history, [AuditRole.MANAGER, AuditRole.LEAD], at);
    expect([...holders.entries()]).toEqual([
      ['moi', [AuditRole.LEAD, AuditRole.MANAGER]],
    ]);
    expect([
      ...holdersAt(history, [AuditRole.LEAD], d('2026-03-29')).keys(),
    ]).toEqual(['cu']);
  });
});

describe('summarize / ratePercent / deadlineOrderError', () => {
  it('chỉ hạn đã đạt hoặc quá hạn vào mẫu số; không có mẫu thì null', () => {
    const row = (
      current: string,
      original = current,
      days = 0,
      extensions = 0,
    ) => ({
      current: { result: current as 'ON_TIME', days },
      original: { result: original as 'ON_TIME', days },
      extensions,
    });
    const summary = summarize([
      row('ON_TIME', 'LATE', 0, 1),
      row('LATE', 'LATE', 4),
      row('LATE', 'LATE', 2),
      row('OVERDUE', 'OVERDUE', 5),
      row('DUE_SOON'),
      row('PENDING'),
    ]);
    expect(summary).toMatchObject({
      total: 6,
      onTime: 1,
      late: 2,
      overdue: 1,
      dueSoon: 1,
      rate: 25,
      onTimeOriginal: 0,
      rateOriginal: 0,
      extensions: 1,
      avgLateDays: 3,
    });
    expect(summarize([row('PENDING')])).toMatchObject({
      rate: null,
      avgLateDays: null,
    });
    expect(ratePercent(2, 3)).toBe(66.7);
  });

  it('hạn phải theo thứ tự kết thúc ≤ soát xét ≤ phát hành', () => {
    expect(
      deadlineOrderError({
        FIELDWORK_END: d('2026-03-10'),
        REPORT_ISSUE: d('2026-03-31'),
      }),
    ).toBeNull();
    expect(
      deadlineOrderError({
        REVIEW_END: d('2026-04-10'),
        REPORT_ISSUE: d('2026-03-31'),
      }),
    ).toMatch(/thứ tự/);
  });
});
