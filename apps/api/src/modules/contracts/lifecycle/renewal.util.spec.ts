import { addYears, shiftPeriod, vietnamToday } from './renewal.util';

describe('renewal helpers', () => {
  it.each([
    ['2025', '2026'],
    ['2025-10', '2026-10'],
    ['2025-Q3', '2026-Q3'],
    ['Năm tài chính 2025', 'Năm tài chính 2025'],
  ])('shifts period %s to %s', (from, to) => {
    expect(shiftPeriod(from)).toBe(to);
  });

  it('keeps an empty period', () => {
    expect(shiftPeriod(null)).toBeNull();
  });

  it('adds a year to business dates, 29/02 becomes 28/02', () => {
    expect(addYears(new Date('2025-12-31T00:00:00Z')).toISOString()).toBe(
      '2026-12-31T00:00:00.000Z',
    );
    expect(addYears(new Date('2024-02-29T00:00:00Z')).toISOString()).toBe(
      '2025-02-28T00:00:00.000Z',
    );
  });

  it('uses the Vietnam calendar day for today', () => {
    expect(vietnamToday(new Date('2026-10-16T18:30:00Z')).toISOString()).toBe(
      '2026-10-17T00:00:00.000Z',
    );
  });
});
