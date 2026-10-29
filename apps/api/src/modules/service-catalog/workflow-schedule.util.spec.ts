import { WorkflowScheduleMode } from '@prisma/client';
import {
  addWorkingDays,
  countWorkingDays,
  nextWorkingDay,
  scheduleSteps,
  SchedulableStep,
} from './workflow-schedule.util';

const day = (v: string) => new Date(`${v}T00:00:00.000Z`);
const iso = (d: Date | null) => d && d.toISOString().slice(0, 10);

/** Mẫu 12 bước "Làm lại sổ sách" của PL1, nối tiếp nhau. */
const DURATIONS = [2, 3, 2, 5, 5, 5, 5, 10, 3, 3, 2, 1];
const sequential = (): SchedulableStep[] =>
  DURATIONS.map((durationDays, i) => ({
    key: `B${i + 1}`,
    durationDays,
    dependsOn: i === 0 ? [] : [`B${i}`],
  }));

describe('ngày làm việc', () => {
  it('cuối tuần dời sang thứ 2', () => {
    expect(iso(nextWorkingDay(day('2026-10-17')))).toBe('2026-10-19');
    expect(iso(nextWorkingDay(day('2026-10-16')))).toBe('2026-10-16');
  });

  it('cộng ngày làm việc bỏ qua thứ 7, chủ nhật', () => {
    expect(iso(addWorkingDays(day('2026-10-16'), 1))).toBe('2026-10-19');
    expect(iso(addWorkingDays(day('2026-10-12'), 4))).toBe('2026-10-16');
    expect(countWorkingDays(day('2026-10-12'), day('2026-10-25'))).toBe(10);
  });
});

describe('scheduleSteps — theo dự án', () => {
  const start = { startDate: day('2026-11-02'), period: '2026-11' };

  it('mẫu 12 bước PL1 nối tiếp ra 46 ngày làm việc', () => {
    const result = scheduleSteps(
      WorkflowScheduleMode.PROJECT,
      sequential(),
      start,
    );
    expect(result.totalWorkingDays).toBe(46);
    expect(iso(result.steps[0].start)).toBe('2026-11-02');
    expect(iso(result.steps[0].end)).toBe('2026-11-03');
    expect(iso(result.steps[1].start)).toBe('2026-11-04');
  });

  it('3 bước kiểm tra hoá đơn / lương / tồn kho song song rút còn 36 ngày', () => {
    const steps = sequential();
    // B6, B7 cùng phụ thuộc B4 như B5; B8 chờ cả ba.
    steps[5].dependsOn = ['B4'];
    steps[6].dependsOn = ['B4'];
    steps[7].dependsOn = ['B5', 'B6', 'B7'];
    const result = scheduleSteps(WorkflowScheduleMode.PROJECT, steps, start);
    expect(result.totalWorkingDays).toBe(36);
    expect(iso(result.steps[4].start)).toBe(iso(result.steps[5].start));
  });

  it('ngày bắt đầu là cuối tuần thì bắt đầu từ thứ 2', () => {
    const result = scheduleSteps(
      WorkflowScheduleMode.PROJECT,
      [{ key: 'A', durationDays: 1, dependsOn: [] }],
      { startDate: day('2026-10-31'), period: '2026-10' },
    );
    expect(iso(result.steps[0].start)).toBe('2026-11-02');
    expect(result.totalWorkingDays).toBe(1);
  });

  it('bước khai báo trước phụ thuộc vẫn được tính sau bước nó chờ', () => {
    const result = scheduleSteps(
      WorkflowScheduleMode.PROJECT,
      [
        { key: 'B', durationDays: 1, dependsOn: ['A'] },
        { key: 'A', durationDays: 2, dependsOn: [] },
      ],
      start,
    );
    expect(iso(result.steps[0].start)).toBe('2026-11-04');
  });
});

describe('scheduleSteps — theo kỳ', () => {
  it('hạn = cuối kỳ + số ngày lệch, giữ công thức cũ', () => {
    const result = scheduleSteps(
      WorkflowScheduleMode.PERIODIC,
      [
        { key: 'B01', dueOffsetDays: 20, dependsOn: [] },
        { key: 'B02', dueOffsetDays: 90, dependsOn: [] },
      ],
      { startDate: day('2026-10-01'), period: '2025' },
    );
    expect(result.steps.map((s) => iso(s.end))).toEqual([
      '2026-01-20',
      '2026-03-31',
    ]);
    expect(result.steps[0].start).toBeNull();
    expect(result.totalWorkingDays).toBeNull();
  });
});
