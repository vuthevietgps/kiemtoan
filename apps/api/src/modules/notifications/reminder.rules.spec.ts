import {
  currentMilestone,
  MAX_ATTEMPTS,
  milestones,
  reminderTitle,
  retryAt,
  sendTimeReached,
} from './reminder.rules';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const due = d('2026-11-20');

describe('Mốc nhắc việc (06, I9/I10/I12)', () => {
  it('mốc theo ngưỡng: email chỉ ở mốc gần nhất, đúng hạn và quá hạn', () => {
    expect(
      milestones([15, 7, 3]).map((m) => [m.key, m.kind, m.severity, m.email]),
    ).toEqual([
      ['D-15', 'DUE_REMINDER', 'INFO', false],
      ['D-7', 'DUE_REMINDER', 'WARNING', false],
      ['D-3', 'DUE_REMINDER', 'WARNING', true],
      ['D0', 'DUE_REMINDER', 'WARNING', true],
      ['D+1', 'OVERDUE', 'DANGER', true],
    ]);
  });

  it('chọn mốc muộn nhất đã tới; bỏ lỡ nhiều mốc chỉ gửi mốc gần nhất', () => {
    const at = (s: string) =>
      currentMilestone(due, d(s), [7, 3, 1])?.key ?? null;
    expect(at('2026-11-12')).toBeNull();
    expect(at('2026-11-13')).toBe('D-7');
    expect(at('2026-11-16')).toBe('D-7');
    expect(at('2026-11-17')).toBe('D-3');
    expect(at('2026-11-19')).toBe('D-1');
    expect(at('2026-11-20')).toBe('D0');
    expect(at('2026-11-21')).toBe('D+1');
    // Quá cửa sổ gửi bù 7 ngày thì không nhắc nữa.
    expect(at('2026-11-28')).toBe('D+1');
    expect(at('2026-11-29')).toBeNull();
  });

  it('chỉ gửi sau giờ gửi theo giờ Việt Nam', () => {
    expect(sendTimeReached(new Date('2026-10-23T00:29:00Z'), '07:30')).toBe(
      false,
    );
    expect(sendTimeReached(new Date('2026-10-23T00:30:00Z'), '07:30')).toBe(
      true,
    );
    expect(sendTimeReached(new Date('2026-10-23T16:59:00Z'), '07:30')).toBe(
      true,
    );
  });

  it('thử lại email sau 1, 5, 15, 60, 240 phút rồi dừng', () => {
    const now = new Date('2026-10-23T01:00:00Z');
    const minutes = [1, 2, 3, 4].map(
      (a) => (retryAt(now, a)!.getTime() - now.getTime()) / 60_000,
    );
    expect(minutes).toEqual([1, 5, 15, 60]);
    expect(retryAt(now, MAX_ATTEMPTS)).toBeNull();
  });

  it('tiêu đề có nhãn mốc, số ngày còn lại và hạn', () => {
    const [, near] = milestones([7, 3, 1]).slice(1);
    expect(reminderTitle(near, 'Tờ khai GTGT — Công ty A', due)).toBe(
      'Gần đến hạn (còn 1 ngày): Tờ khai GTGT — Công ty A, hạn 20/11/2026',
    );
  });
});
