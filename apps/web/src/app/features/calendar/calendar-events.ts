import type { EventInput } from '@fullcalendar/core';
import { toDateKey } from '../../shared/utils/date-key';
import type { CalendarDay, CalendarEvent } from './data-access/calendar.api';

/** Ô ngày của FullCalendar dùng giờ địa phương. */
export const dayKey = toDateKey;

/** Màu theo mức gấp (I11); mục đã xong/đã nộp tô xám nhạt. */
export function toneOf(event: CalendarEvent): string {
  if (event.done) return 'done';
  return (event.urgency ?? 'NORMAL').toLowerCase();
}

export function eventLabel(event: CalendarEvent): string {
  if (event.kind === 'OBLIGATION') {
    const period = event.period ? ` kỳ ${event.period}` : '';
    return `${event.code}${period} — ${event.customer.name}`;
  }
  return `${event.title} — ${event.customer.name}`;
}

/** Chuyển dữ liệu API sang mục của FullCalendar; giữ bản gốc trong extendedProps để mở chi tiết. */
export function toCalendarInputs(events: CalendarEvent[]): EventInput[] {
  return events.map((event) => ({
    id: `${event.kind}:${event.id}`,
    title: eventLabel(event),
    start: event.date,
    allDay: true,
    classNames: [
      'cal-event',
      event.kind === 'OBLIGATION' ? 'cal-statutory' : 'cal-internal',
      `cal-tone-${toneOf(event)}`,
    ],
    extendedProps: { source: event },
  }));
}

/**
 * Ngày không làm việc để tô xám (I2/I14): ngày Nghỉ của năm đã xác nhận, cùng thứ 7/CN trừ ngày
 * Làm bù. Trả tên ngày nghỉ/làm bù (nếu có) để hiện khi rê chuột.
 */
export function dayInfo(
  date: Date,
  days: Map<string, CalendarDay>,
): { off: boolean; name: string | null } {
  const special = days.get(dayKey(date));
  if (special) return { off: special.kind === 'DAY_OFF', name: special.name };
  const weekday = date.getDay();
  return { off: weekday === 0 || weekday === 6, name: null };
}
