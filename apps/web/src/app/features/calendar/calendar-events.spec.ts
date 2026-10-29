import { describe, expect, it } from 'vitest';
import { dayInfo, eventLabel, toCalendarInputs, toneOf } from './calendar-events';
import type { CalendarDay, CalendarEvent } from './data-access/calendar.api';

const customer = { id: 'c1', name: 'Công ty A' };
const obligation = (patch: Partial<CalendarEvent> = {}) =>
  ({
    kind: 'OBLIGATION',
    id: 'o1',
    code: 'GTGT-T',
    date: '2027-03-20',
    title: 'Tờ khai GTGT tháng',
    status: 'NOT_DUE',
    done: false,
    overdue: false,
    urgency: 'DUE_SOON',
    period: '2027-02',
    customer,
    person: null,
    obligationType: { id: 't', code: 'GTGT-T', name: 'Tờ khai GTGT tháng' },
    filedLate: false,
    tasks: [],
    ...patch,
  }) as CalendarEvent;
const task = (patch: Partial<CalendarEvent> = {}) =>
  ({
    kind: 'TASK',
    id: 't1',
    code: 'CV-1',
    date: '2027-03-18',
    title: 'Lập tờ khai',
    status: 'IN_PROGRESS',
    done: false,
    overdue: true,
    urgency: 'OVERDUE',
    period: null,
    customer,
    person: { id: 'u', fullName: 'NV' },
    isStatutory: false,
    obligationId: null,
    ...patch,
  }) as CalendarEvent;

describe('calendar-events (06-D, I14)', () => {
  it('nhãn: nghĩa vụ hiện mã + kỳ + KH; việc hiện tên việc + KH', () => {
    expect(eventLabel(obligation())).toBe('GTGT-T kỳ 2027-02 — Công ty A');
    expect(eventLabel(task())).toBe('Lập tờ khai — Công ty A');
  });

  it('màu theo mức gấp; đã xong/đã nộp luôn là "done", không có mức gấp coi là bình thường', () => {
    expect(toneOf(task())).toBe('overdue');
    expect(toneOf(obligation({ done: true, urgency: null }))).toBe('done');
    expect(toneOf(obligation({ urgency: null }))).toBe('normal');
  });

  it('mục lịch cả ngày, phân biệt pháp lý/nội bộ, mã duy nhất theo loại và giữ bản gốc', () => {
    const [o, t] = toCalendarInputs([obligation(), task()]);
    expect(o).toMatchObject({
      id: 'OBLIGATION:o1',
      start: '2027-03-20',
      allDay: true,
      classNames: ['cal-event', 'cal-statutory', 'cal-tone-due_soon'],
    });
    expect(t.id).toBe('TASK:t1');
    expect(t.classNames).toEqual(['cal-event', 'cal-internal', 'cal-tone-overdue']);
    expect((t.extendedProps as { source: CalendarEvent }).source.id).toBe('t1');
  });

  it('ngày nghỉ: thứ 7/CN và ngày Nghỉ đã xác nhận; ngày Làm bù không tô xám', () => {
    const days = new Map<string, CalendarDay>([
      ['2027-03-08', { date: '2027-03-08', kind: 'DAY_OFF', name: 'Nghỉ lễ' }],
      ['2027-03-13', { date: '2027-03-13', kind: 'WORKDAY', name: 'Làm bù' }],
    ]);
    expect(dayInfo(new Date(2027, 2, 8), days)).toEqual({ off: true, name: 'Nghỉ lễ' });
    expect(dayInfo(new Date(2027, 2, 13), days)).toEqual({ off: false, name: 'Làm bù' });
    expect(dayInfo(new Date(2027, 2, 14), days)).toEqual({ off: true, name: null });
    expect(dayInfo(new Date(2027, 2, 9), days)).toEqual({ off: false, name: null });
  });
});
