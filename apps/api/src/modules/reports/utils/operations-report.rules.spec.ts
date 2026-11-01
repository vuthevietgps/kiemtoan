import {
  addOutcome,
  complianceOutcome,
  customerFlow,
  effectiveOn,
  emptyCounts,
  onTimeRate,
  ratio,
} from './operations-report.rules';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const today = d('2026-10-30');
const year = { from: d('2026-01-01'), to: d('2026-12-31') };

describe('operations-report.rules (10-C)', () => {
  it('M6: nộp đúng ngày hạn = đúng hạn; sau hạn = trễ N ngày; chưa nộp quá hạn / chưa đến hạn', () => {
    expect(complianceOutcome(d('2026-10-20'), d('2026-10-20'), today)).toEqual({
      outcome: 'ON_TIME',
      daysLate: 0,
    });
    expect(complianceOutcome(d('2026-10-20'), d('2026-10-23'), today)).toEqual({
      outcome: 'LATE',
      daysLate: 3,
    });
    expect(complianceOutcome(d('2026-10-20'), null, today)).toEqual({
      outcome: 'OVERDUE',
      daysLate: 10,
    });
    expect(complianceOutcome(d('2026-10-30'), null, today).outcome).toBe(
      'NOT_DUE',
    );
  });

  it('tỷ lệ đúng hạn bỏ "chưa đến hạn"; không có mẫu → null; do khách chỉ đếm khi trễ / quá hạn', () => {
    const c = emptyCounts();
    addOutcome(c, 'ON_TIME', true);
    addOutcome(c, 'LATE', true);
    addOutcome(c, 'OVERDUE', false);
    addOutcome(c, 'NOT_DUE', true);
    expect(c).toEqual({
      onTime: 1,
      late: 1,
      overdue: 1,
      notDue: 1,
      clientDelay: 1,
    });
    expect(onTimeRate(c)).toBe(33.3);
    expect(onTimeRate(emptyCounts())).toBeNull();
    expect(ratio(1, 0)).toBeNull();
  });

  it('hiệu lực tại một ngày cần đã duyệt, đã bắt đầu, chưa kết thúc', () => {
    const c = {
      approvedOn: d('2026-02-01'),
      startDate: d('2026-01-01'),
      endDate: d('2026-06-30'),
    };
    expect(effectiveOn(c, d('2026-01-15'))).toBe(false); // chưa duyệt
    expect(effectiveOn(c, d('2026-06-30'))).toBe(true);
    expect(effectiveOn(c, d('2026-07-01'))).toBe(false);
    expect(effectiveOn({ ...c, approvedOn: null }, d('2026-03-01'))).toBe(
      false,
    );
  });

  it('M8: khách ngừng rồi quay lại không tính là khách mới, không tính ngừng ở kỳ quay lại', () => {
    const before = {
      approvedOn: d('2024-01-05'),
      startDate: d('2024-01-01'),
      endDate: d('2025-06-30'),
    };
    const back = {
      approvedOn: d('2026-03-10'),
      startDate: d('2026-03-01'),
      endDate: null,
    };
    expect(customerFlow([before, back], year)).toMatchObject({
      isNew: false,
      stopped: false,
      activeAtStart: false,
      activeAtEnd: true,
    });
  });

  it('M8: khách mới, ngừng, giữ chân; tái ký sau kỳ thì không tính ngừng', () => {
    const old = {
      approvedOn: d('2025-01-05'),
      startDate: d('2025-01-01'),
      endDate: d('2026-03-31'),
    };
    expect(customerFlow([old], year)).toMatchObject({
      isNew: false,
      stopped: true,
      stoppedOn: d('2026-03-31'),
      activeAtStart: true,
      activeAtEnd: false,
    });
    const renewal = {
      approvedOn: d('2027-01-02'),
      startDate: d('2027-01-01'),
      endDate: d('2027-12-31'),
    };
    expect(customerFlow([old, renewal], year).stopped).toBe(false);
    const fresh = {
      approvedOn: d('2026-05-10'),
      startDate: d('2026-05-01'),
      endDate: null,
    };
    expect(customerFlow([fresh], year)).toMatchObject({
      isNew: true,
      stopped: false,
      activeAtStart: false,
      activeAtEnd: true,
    });
    const kept = {
      approvedOn: d('2025-12-01'),
      startDate: d('2025-12-01'),
      endDate: null,
    };
    expect(customerFlow([kept], year)).toMatchObject({
      activeAtStart: true,
      activeAtEnd: true,
    });
  });
});
