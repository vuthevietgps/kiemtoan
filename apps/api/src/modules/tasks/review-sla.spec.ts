import { REVIEW_SLA_WORKING_DAYS, workingDaysWaited } from './review-sla';

const at = (iso: string) => new Date(iso);

describe('workingDaysWaited — SLA soát xét (G7)', () => {
  it('không tính ngày vào cấp; chỉ đếm thứ 2–6', () => {
    // Thứ 6 23/10/2026 10:00 giờ VN vào cấp.
    const entered = at('2026-10-23T03:00:00Z');
    expect(workingDaysWaited(entered, at('2026-10-23T10:00:00Z'))).toBe(0);
    // Thứ 7, Chủ nhật không tính.
    expect(workingDaysWaited(entered, at('2026-10-25T10:00:00Z'))).toBe(0);
    // Thứ 2, thứ 3.
    expect(workingDaysWaited(entered, at('2026-10-26T10:00:00Z'))).toBe(1);
    expect(workingDaysWaited(entered, at('2026-10-27T10:00:00Z'))).toBe(2);
    // Thứ 4: quá SLA 2 ngày làm việc.
    expect(
      workingDaysWaited(entered, at('2026-10-28T10:00:00Z')),
    ).toBeGreaterThan(REVIEW_SLA_WORKING_DAYS);
  });

  it('ngày theo giờ Việt Nam: 23:30 UTC là sáng hôm sau ở VN', () => {
    // Vào cấp 22/10 23:30 UTC = 23/10 06:30 VN.
    expect(
      workingDaysWaited(at('2026-10-22T23:30:00Z'), at('2026-10-23T09:00:00Z')),
    ).toBe(0);
  });
});
