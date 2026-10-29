import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';
import type { TaskStatus, Urgency } from '../../tasks/task-labels';
import type { CalendarKindFilter, CalendarStatusFilter } from '../calendar.text';

interface IdName {
  id: string;
  name: string;
}

interface Person {
  id: string;
  fullName: string;
}

interface EventBase {
  id: string;
  code: string;
  /** Ngày hạn 'YYYY-MM-DD'. */
  date: string;
  title: string;
  done: boolean;
  overdue: boolean;
  urgency: Urgency | null;
  period: string | null;
  customer: IdName;
  person: Person | null;
}

export interface TaskEvent extends EventBase {
  kind: 'TASK';
  status: TaskStatus;
  isStatutory: boolean;
  obligationId: string | null;
}

export interface ObligationEvent extends EventBase {
  kind: 'OBLIGATION';
  /** Trạng thái lịch báo cáo; 'OVERDUE' = chưa nộp mà quá hạn. */
  status: string;
  obligationType: { id: string; code: string; name: string };
  filedLate: boolean;
  tasks: { id: string; code: string; title: string; status: TaskStatus }[];
}

export type CalendarEvent = TaskEvent | ObligationEvent;

export interface CalendarDay {
  date: string;
  kind: 'DAY_OFF' | 'WORKDAY';
  name: string;
}

export interface CalendarEventsResult {
  events: CalendarEvent[];
  truncated: boolean;
  days: CalendarDay[];
  unconfirmedYears: number[];
}

export interface CalendarFilters {
  customerId: string | null;
  userId: string | null;
  obligationTypeId: string | null;
  kind: CalendarKindFilter | null;
  status: CalendarStatusFilter | null;
}

export interface ObligationTypeOption {
  id: string;
  code: string;
  name: string;
}

/** API Lịch & Deadline (06, I14). */
@Injectable({ providedIn: 'root' })
export class CalendarApi {
  private readonly http = inject(HttpClient);

  events(from: string, to: string, filters: CalendarFilters): Observable<CalendarEventsResult> {
    return this.http.get<CalendarEventsResult>(`${API_URL}/calendar/events`, {
      params: toParams({ from, to, ...filters }),
    });
  }

  /** Loại nghĩa vụ cho ô lọc (cần `deadlines:view`). */
  obligationTypes(): Observable<ObligationTypeOption[]> {
    return this.http.get<ObligationTypeOption[]>(`${API_URL}/obligation-types`);
  }
}
