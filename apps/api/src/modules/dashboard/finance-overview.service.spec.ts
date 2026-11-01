import { vnMoments } from '../reports/utils/contract-filter.util';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('vnMoments (10, M4)', () => {
  it('kỳ theo ngày giờ VN → khoảng thời điểm UTC: 00:00 VN ngày đầu đến hết 23:59 VN ngày cuối', () => {
    const { gte, lt } = vnMoments({
      from: d('2026-10-01'),
      to: d('2026-10-31'),
    });
    expect(gte.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(lt.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    // Duyệt 23:30 giờ VN ngày 31/10 vẫn thuộc kỳ; 00:10 VN ngày 01/11 thì không.
    expect(new Date('2026-10-31T16:30:00Z') < lt).toBe(true);
    expect(new Date('2026-10-31T17:10:00Z') < lt).toBe(false);
  });
});
