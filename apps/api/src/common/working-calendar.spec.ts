import {
  addWorkingDays,
  computeDueDate,
  countWorkingDays,
  scheduleSteps,
} from '../modules/service-catalog/workflow-schedule.util';
import {
  buildWorkingCalendar,
  nextWorkingDayIn,
  previousWorkingDayIn,
  WEEKDAY_CALENDAR,
} from './working-calendar';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

// Lịch năm 2026 giả định cho test (không phải lịch nghỉ thật — QD07).
const calendar2026 = buildWorkingCalendar({
  confirmedYears: [2026],
  days: [
    { date: d('2026-09-02'), kind: 'DAY_OFF' }, // thứ 4
    { date: d('2026-09-03'), kind: 'DAY_OFF' }, // thứ 5
    { date: d('2026-09-05'), kind: 'WORKDAY' }, // thứ 7 làm bù
    { date: d('2027-01-01'), kind: 'DAY_OFF' }, // năm 2027 chưa xác nhận → bỏ qua
  ],
});

describe('Lịch làm việc 06 (I2)', () => {
  it('năm đã xác nhận: trừ ngày nghỉ, cộng ngày làm bù; năm chưa xác nhận: thứ 2–6', () => {
    expect(calendar2026.isWorkingDay(d('2026-09-02'))).toBe(false);
    expect(calendar2026.isWorkingDay(d('2026-09-05'))).toBe(true);
    expect(calendar2026.isWorkingDay(d('2026-09-06'))).toBe(false);
    expect(calendar2026.isWorkingDay(d('2027-01-01'))).toBe(true);
    expect(calendar2026.isConfirmed(d('2026-12-31'))).toBe(true);
    expect(calendar2026.isConfirmed(d('2027-01-01'))).toBe(false);
    expect(WEEKDAY_CALENDAR.isConfirmed(d('2026-01-01'))).toBe(false);
  });

  it('ngày làm việc kế tiếp/liền trước bỏ qua chuỗi ngày nghỉ', () => {
    expect(iso(nextWorkingDayIn(calendar2026, d('2026-09-02')))).toBe(
      '2026-09-04',
    );
    expect(iso(previousWorkingDayIn(calendar2026, d('2026-09-03')))).toBe(
      '2026-09-01',
    );
  });

  it('thời lượng bước và số ngày làm việc theo lịch (D2 + I2)', () => {
    // Bắt đầu 01/09 (thứ 3), 4 ngày làm việc: 01, 04, 05 (làm bù), 07.
    expect(iso(addWorkingDays(d('2026-09-01'), 3, calendar2026))).toBe(
      '2026-09-07',
    );
    expect(iso(addWorkingDays(d('2026-09-01'), 3))).toBe('2026-09-04');
    expect(
      countWorkingDays(d('2026-09-01'), d('2026-09-07'), calendar2026),
    ).toBe(4);
  });

  it('I3: hạn nội bộ theo kỳ trùng ngày nghỉ của năm đã xác nhận lùi về ngày làm việc trước', () => {
    // Cuối kỳ 2026-08 + 2 ngày = 02/09 (nghỉ) → 01/09.
    expect(iso(computeDueDate('2026-08', 2, calendar2026))).toBe('2026-09-01');
    // Không truyền lịch hoặc năm chưa xác nhận: giữ ngày lịch như trước.
    expect(iso(computeDueDate('2026-08', 2))).toBe('2026-09-02');
    expect(iso(computeDueDate('2026-12', 6, calendar2026))).toBe('2027-01-06');
  });

  it('lịch dự án dùng lịch làm việc khi truyền vào', () => {
    const schedule = scheduleSteps(
      'PROJECT',
      [
        { key: 'B01', dependsOn: [], durationDays: 2 },
        { key: 'B02', dependsOn: ['B01'], durationDays: 1 },
      ],
      { startDate: d('2026-09-01'), period: '2026-09', calendar: calendar2026 },
    );
    expect(schedule.steps.map((s) => [iso(s.start!), iso(s.end)])).toEqual([
      ['2026-09-01', '2026-09-04'],
      ['2026-09-05', '2026-09-05'],
    ]);
  });
});
