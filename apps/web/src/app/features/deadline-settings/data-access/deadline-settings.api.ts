import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';

export type Conditions = Partial<Record<string, string[]>>;

/** Quy tắc hạn của một phiên bản (I1, I3). */
export interface RuleInput {
  effectiveFrom: string;
  dueRule: 'MONTH_AFTER_END' | 'FIXED_IN_YEAR';
  monthsAfter: number | null;
  dueMonth: number | null;
  dueDay: number;
  useFiscalYear: boolean;
  holidayShift: 'NEXT' | 'PREVIOUS';
  conditions: Conditions;
  legalBasis: string | null;
  note: string | null;
}

export interface TypeVersion extends RuleInput {
  id: string;
  versionNo: number;
  status: 'DRAFT' | 'CONFIRMED';
  revision: number;
  confirmedAt: string | null;
}

export interface ObligationType {
  id: string;
  code: string;
  name: string;
  group: string;
  family: string;
  cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  retiredAt: string | null;
  retireReason: string | null;
  versions: TypeVersion[];
  services: { id: string; code: string; name: string }[];
}

export interface CreateTypeInput extends RuleInput {
  code: string;
  name: string;
  group: string;
  family?: string;
  cycle: string;
}

export interface SyncSummary {
  created: number;
  revived: number;
  retired: number;
}

export interface PreviewResult {
  versionNo: number;
  status: string;
  customer: { id: string; name: string };
  applies: boolean;
  periods: { period: string; periodEnd: string; ruleDue: string; dueDate: string }[];
}

export interface CalendarYear {
  year: number;
  status: 'DRAFT' | 'CONFIRMED';
  revision: number | null;
  confirmedAt: string | null;
  days: { date: string; kind: 'DAY_OFF' | 'WORKDAY'; name: string }[];
  changedDues?: number;
}

export interface ReminderSettings {
  thresholds: number[];
  sendTime: string;
  escalationWorkingDays: number;
  revision: number;
}

export interface ServiceThreshold {
  serviceTypeId: string;
  thresholds: number[];
  serviceType: { id: string; code: string; name: string };
}

export interface Delivery {
  id: string;
  channel: 'IN_APP' | 'EMAIL';
  status: string;
  title: string;
  milestone: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  user: { id: string; fullName: string; email: string };
}

export interface DeliveryQuery {
  page: number;
  pageSize: number;
  status: string | null;
  channel: string | null;
  search: string;
}

/** API cấu hình 06: loại nghĩa vụ, lịch năm, nhắc việc, nhật ký gửi. */
@Injectable({ providedIn: 'root' })
export class DeadlineSettingsApi {
  private readonly http = inject(HttpClient);
  private readonly types = `${API_URL}/obligation-types`;

  listTypes(): Observable<ObligationType[]> {
    return this.http.get<ObligationType[]>(this.types);
  }

  createType(input: CreateTypeInput): Observable<ObligationType> {
    return this.http.post<ObligationType>(this.types, input);
  }

  saveDraft(id: string, input: RuleInput, revision?: number): Observable<ObligationType> {
    return this.http.put<ObligationType>(`${this.types}/${id}/draft`, { ...input, revision });
  }

  confirmDraft(
    id: string,
    revision: number,
  ): Observable<ObligationType & { changedDues: number; synced: SyncSummary }> {
    return this.http.post<ObligationType & { changedDues: number; synced: SyncSummary }>(
      `${this.types}/${id}/draft/confirm`,
      { revision },
    );
  }

  retire(id: string, reason: string): Observable<ObligationType & { synced: SyncSummary }> {
    return this.http.post<ObligationType & { synced: SyncSummary }>(`${this.types}/${id}/retire`, {
      reason,
    });
  }

  setServices(
    id: string,
    serviceTypeIds: string[],
  ): Observable<ObligationType & { synced: SyncSummary }> {
    return this.http.put<ObligationType & { synced: SyncSummary }>(`${this.types}/${id}/services`, {
      serviceTypeIds,
    });
  }

  preview(id: string, customerId: string): Observable<PreviewResult> {
    return this.http.get<PreviewResult>(`${this.types}/${id}/preview`, {
      params: { customerId, periods: 12 },
    });
  }

  calendarYear(year: number): Observable<CalendarYear> {
    return this.http.get<CalendarYear>(`${API_URL}/business-calendar/${year}`);
  }

  saveYear(
    year: number,
    days: CalendarYear['days'],
    revision: number | null,
    reason?: string,
  ): Observable<CalendarYear> {
    return this.http.put<CalendarYear>(`${API_URL}/business-calendar/${year}`, {
      days,
      ...(revision && { revision }),
      ...(reason && { reason }),
    });
  }

  confirmYear(year: number, revision: number): Observable<CalendarYear> {
    return this.http.post<CalendarYear>(`${API_URL}/business-calendar/${year}/confirm`, { revision });
  }

  reminderSettings(): Observable<ReminderSettings> {
    return this.http.get<ReminderSettings>(`${API_URL}/reminder-settings`);
  }

  saveReminderSettings(input: ReminderSettings): Observable<ReminderSettings> {
    return this.http.put<ReminderSettings>(`${API_URL}/reminder-settings`, input);
  }

  serviceThresholds(): Observable<ServiceThreshold[]> {
    return this.http.get<ServiceThreshold[]>(`${API_URL}/service-urgency-thresholds`);
  }

  setServiceThresholds(serviceTypeId: string, thresholds: number[]): Observable<unknown> {
    return this.http.put(`${API_URL}/service-urgency-thresholds/${serviceTypeId}`, { thresholds });
  }

  removeServiceThresholds(serviceTypeId: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/service-urgency-thresholds/${serviceTypeId}`);
  }

  deliveries(query: DeliveryQuery): Observable<Paginated<Delivery>> {
    return this.http.get<Paginated<Delivery>>(`${API_URL}/notification-deliveries`, {
      params: toParams({ ...query }),
    });
  }

  retryDelivery(id: string): Observable<unknown> {
    return this.http.post(`${API_URL}/notification-deliveries/${id}/retry`, {});
  }

  runReminders(): Observable<{ inApp: number; emailsQueued: number; skipped: boolean }> {
    return this.http.post<{ inApp: number; emailsQueued: number; skipped: boolean }>(
      `${API_URL}/reminders/run`,
      {},
    );
  }
}
