import { BillingCycle, WorkflowScheduleMode } from '@prisma/client';
import { generationPeriods, MAX_PERIODS, periodOf } from './task-periods';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const base = {
  cycle: BillingCycle.MONTHLY,
  scheduleMode: WorkflowScheduleMode.PERIODIC,
  planPeriod: '2026-01',
  contractStart: d('2026-01-01'),
  contractEnd: d('2026-12-31'),
};

describe('generationPeriods (H12)', () => {
  it('dịch vụ theo tháng, HĐ 12 tháng → 12 kỳ từ kỳ của kế hoạch', () => {
    const periods = generationPeriods(base);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toBe('2026-01');
    expect(periods[11]).toBe('2026-12');
  });

  it('kế hoạch làm cho kỳ trước (dời theo kỳ): vẫn đủ số kỳ của thời hạn HĐ', () => {
    expect(generationPeriods({ ...base, planPeriod: '2025-12' })).toEqual([
      '2025-12',
      ...Array.from(
        { length: 11 },
        (_, i) => `2026-${String(i + 1).padStart(2, '0')}`,
      ),
    ]);
  });

  it('HĐ bắt đầu giữa tháng vẫn tính tháng đó; qua năm đúng', () => {
    expect(
      generationPeriods({
        ...base,
        planPeriod: '2026-11',
        contractStart: d('2026-11-15'),
        contractEnd: d('2027-02-10'),
      }),
    ).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('dịch vụ theo quý → các quý trong thời hạn HĐ', () => {
    expect(
      generationPeriods({
        ...base,
        cycle: BillingCycle.QUARTERLY,
        planPeriod: '2026-Q1',
      }),
    ).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
  });

  it('giữ một kỳ: theo năm/một lần, theo dự án, HĐ chưa có ngày kết thúc, kỳ khác loại chu kỳ', () => {
    for (const input of [
      { ...base, cycle: BillingCycle.YEARLY },
      { ...base, cycle: BillingCycle.ONE_TIME },
      { ...base, scheduleMode: WorkflowScheduleMode.PROJECT },
      { ...base, contractEnd: null },
      { ...base, contractEnd: d('2025-12-31') },
      { ...base, cycle: BillingCycle.QUARTERLY, planPeriod: '2026-01' },
      { ...base, planPeriod: '2026' },
      { ...base, cycle: undefined },
    ])
      expect(generationPeriods(input)).toEqual([input.planPeriod]);
  });

  it(`chặn tối đa ${MAX_PERIODS} kỳ khi ngày kết thúc nhập nhầm`, () => {
    expect(
      generationPeriods({ ...base, contractEnd: d('2099-12-31') }),
    ).toHaveLength(MAX_PERIODS);
  });

  it('periodOf theo tháng và quý (UTC)', () => {
    expect(periodOf(d('2026-03-31'), 'MONTH')).toBe('2026-03');
    expect(periodOf(d('2026-03-31'), 'QUARTER')).toBe('2026-Q1');
    expect(periodOf(d('2026-10-01'), 'QUARTER')).toBe('2026-Q4');
  });
});
