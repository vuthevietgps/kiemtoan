import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../data-access/calendar.api';
import { CalendarEventDrawerComponent } from './calendar-event-drawer.component';

const obligation = {
  kind: 'OBLIGATION',
  id: 'o1',
  code: 'GTGT-T',
  date: '2027-02-20',
  title: 'Tờ khai GTGT tháng',
  status: 'OVERDUE',
  done: false,
  overdue: true,
  urgency: 'OVERDUE',
  period: '2027-01',
  customer: { id: 'c1', name: 'Công ty A' },
  person: { id: 'u1', fullName: 'Nhân viên A' },
  obligationType: { id: 't', code: 'GTGT-T', name: 'Tờ khai GTGT tháng' },
  filedLate: false,
  tasks: [{ id: 'task-1', code: 'CV-2027-00001', title: 'Lập tờ khai', status: 'IN_PROGRESS' }],
} as CalendarEvent;

describe('CalendarEventDrawerComponent (06-D)', () => {
  function render(event: CalendarEvent) {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(CalendarEventDrawerComponent);
    fixture.componentRef.setInput('event', event);
    fixture.detectChanges();
    return fixture;
  }

  it('nghĩa vụ trễ hạn: hiện "Trễ hạn", người phụ trách KH, việc gắn mở được', () => {
    const fixture = render(obligation);
    const opened: string[] = [];
    fixture.componentInstance.openTask.subscribe((id) => opened.push(id));
    const text = document.body.textContent ?? '';
    expect(text).toContain('Trễ hạn');
    expect(text).toContain('Phụ trách khách hàng');
    expect(text).toContain('Nhân viên A');
    expect(text).toContain('20/02/2027');
    const linked = document.body.querySelector<HTMLButtonElement>('button.linked');
    expect(linked?.textContent).toContain('CV-2027-00001');
    linked?.click();
    expect(opened).toEqual(['task-1']);
    // Nghĩa vụ không có nút "Mở việc" riêng, chỉ mở qua việc gắn.
    expect(text).not.toContain('Mở việc');
  });
});
