import { Prisma } from '@prisma/client';
import {
  changePercent,
  currentMonth,
  isOnTime,
  monthsOf,
  previousPeriod,
  resolvePeriod,
  toBusinessDate,
  todayVn,
} from './period.util';

const d = toBusinessDate;
const dec = (v: number) => new Prisma.Decimal(v);

describe('period.util', () => {
  describe('changePercent', () => {
    it('tính % tăng/giảm so với kỳ trước, làm tròn 1 chữ số', () => {
      expect(changePercent(dec(150), dec(100))).toBe(50);
      expect(changePercent(dec(80), dec(100))).toBe(-20);
      expect(changePercent(dec(1), dec(3))).toBe(-66.7);
    });

    it('kỳ trước bằng 0: cả hai bằng 0 → 0, kỳ này có số → null', () => {
      expect(changePercent(dec(0), dec(0))).toBe(0);
      expect(changePercent(dec(500), dec(0))).toBeNull();
    });
  });

  it('kỳ trước có cùng số ngày, liền ngay trước', () => {
    const prev = previousPeriod({ from: d('2026-10-01'), to: d('2026-10-31') });
    expect(prev.from).toEqual(d('2026-08-31'));
    expect(prev.to).toEqual(d('2026-09-30'));
  });

  it('mặc định tháng hiện tại theo giờ Việt Nam', () => {
    // 31/10 lúc 18:00 UTC đã là 01/11 ở Việt Nam
    const p = currentMonth(new Date('2026-10-31T18:00:00Z'));
    expect(p.from).toEqual(d('2026-11-01'));
    expect(p.to).toEqual(d('2026-11-30'));
    expect(todayVn(new Date('2026-10-31T16:59:00Z'))).toEqual(d('2026-10-31'));
  });

  it('từ chối khoảng ngày ngược', () => {
    expect(() =>
      resolvePeriod('2026-10-10', '2026-10-01', currentMonth()),
    ).toThrow();
  });

  it('liệt kê tháng trong kỳ, kể cả qua năm', () => {
    expect(monthsOf({ from: d('2025-11-15'), to: d('2026-02-01') })).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  describe('isOnTime', () => {
    const due = d('2026-10-20');
    it('xong trong ngày hạn (giờ VN) là đúng hạn', () => {
      expect(isOnTime(new Date('2026-10-20T16:59:00Z'), due)).toBe(true);
    });
    it('xong sau 0h ngày hôm sau (giờ VN) là trễ hạn', () => {
      expect(isOnTime(new Date('2026-10-20T17:01:00Z'), due)).toBe(false);
    });
  });
});
