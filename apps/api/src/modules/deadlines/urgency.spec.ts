import {
  DEFAULT_THRESHOLDS,
  thresholdsError,
  thresholdsFor,
  urgencyOf,
  urgencyRank,
} from './urgency';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const today = d('2026-10-23');

describe('Mức gấp tự động (06, I11)', () => {
  it('theo bảng PL1 IV.2 với ngưỡng mặc định 7/3/1', () => {
    const at = (s: string) => urgencyOf(d(s), today, DEFAULT_THRESHOLDS);
    expect(at('2026-11-01')).toBe('NORMAL'); // còn 9 ngày
    expect(at('2026-10-30')).toBe('DUE_SOON'); // còn 7
    expect(at('2026-10-27')).toBe('DUE_SOON'); // còn 4
    expect(at('2026-10-26')).toBe('PRIORITY'); // còn 3
    expect(at('2026-10-25')).toBe('PRIORITY'); // còn 2
    expect(at('2026-10-24')).toBe('NEAR'); // còn 1
    expect(at('2026-10-23')).toBe('TODAY');
    expect(at('2026-10-22')).toBe('OVERDUE');
  });

  it('ngưỡng riêng theo dịch vụ thay ngưỡng chung', () => {
    const config = {
      global: DEFAULT_THRESHOLDS,
      byService: new Map([['qt-nam', [15, 7, 3]]]),
    };
    expect(
      urgencyOf(d('2026-11-02'), today, thresholdsFor(config, 'qt-nam')),
    ).toBe('DUE_SOON');
    expect(
      urgencyOf(d('2026-11-02'), today, thresholdsFor(config, 'khac')),
    ).toBe('NORMAL');
    expect(thresholdsFor(config, null)).toEqual(DEFAULT_THRESHOLDS);
  });

  it('thứ tự gấp nhất trước; việc xong (null) cuối cùng', () => {
    const list = ['NORMAL', null, 'OVERDUE', 'NEAR', 'TODAY'] as const;
    expect([...list].sort((a, b) => urgencyRank(a) - urgencyRank(b))).toEqual([
      'OVERDUE',
      'TODAY',
      'NEAR',
      'NORMAL',
      null,
    ]);
  });

  it('ngưỡng hợp lệ: 3 số nguyên giảm dần trong 1–90', () => {
    expect(thresholdsError([7, 3, 1])).toBeNull();
    expect(thresholdsError([15, 7, 3])).toBeNull();
    expect(thresholdsError([3, 7, 1])).toContain('giảm dần');
    expect(thresholdsError([7, 7, 1])).toContain('giảm dần');
    expect(thresholdsError([7, 3])).toContain('3 số ngày');
    expect(thresholdsError([100, 3, 1])).toContain('1 đến 90');
    expect(thresholdsError([7, 3, 0.5])).toContain('nguyên');
  });
});
