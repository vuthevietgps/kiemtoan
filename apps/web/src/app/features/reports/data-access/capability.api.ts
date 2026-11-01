import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';
import type { DeadlineKind, DeadlineResult } from '../../contracts/data-access/audit-tracking.api';

/** Đánh giá năng lực (10-E, khung G1–G10): không có số tiền. */
export type CapabilityRole = 'ASSISTANT' | 'LEAD' | 'MANAGER';
export type CapabilityDomain = 'ALL' | 'ACCOUNTING' | 'AUDIT';
export type Rate = number | null;

export interface CapabilityQuery {
  from: string;
  to: string;
  role: CapabilityRole;
  domain: CapabilityDomain;
  teamId?: string | null;
}

export interface Person {
  id: string;
  fullName: string;
  teamId: string | null;
}

export interface AssistantRow {
  user: Person;
  total: number;
  onTime: number;
  late: number;
  overdue: number;
  rate: Rate;
  rateOriginal: Rate;
  statutoryLate: number;
  clientDelay: number;
  extensions: number;
  submitted: number;
  returned: number;
  returnRate: Rate;
  accepted: number;
  openCustomers: number;
}

export interface PeriodSummary {
  total: number;
  onTime: number;
  late: number;
  overdue: number;
  rate: Rate;
  rateOriginal: Rate;
  statutoryLate: number;
  extendedRate: Rate;
}

export interface AuditSummary {
  total: number;
  onTime: number;
  late: number;
  overdue: number;
  rate: Rate;
  rateOriginal: Rate;
  extensions: number;
  activeEngagements: number;
}

export interface ReviewSummary {
  count: number;
  avgDays: number | null;
  withinSla: number;
  slaRate: Rate;
  returned: number;
  overSlaNow: number;
}

export interface TeamRow {
  user: Person;
  periods: PeriodSummary;
  audit: AuditSummary | null;
  reviews?: ReviewSummary;
}

export interface CapabilityReport<R = AssistantRow | TeamRow> {
  from: string;
  to: string;
  role: CapabilityRole;
  domain: CapabilityDomain;
  rows: R[];
}

export interface AssistantItem {
  id: string;
  code: string;
  title: string;
  customer: { id: string; name: string };
  status: string;
  dueDate: string;
  originalDueDate: string;
  milestone: string | null;
  counted: boolean;
  result: DeadlineResult;
  days: number;
  originalResult: DeadlineResult;
  waitDays: number;
  clientDelay: boolean;
  statutory: boolean;
  statutoryLate: boolean;
  extensions: number;
  returnCount: number;
}

export interface PeriodItem {
  key: string;
  contract: { id: string; code: string };
  customerName: string;
  service: string;
  period: string;
  due: string;
  originalDue: string;
  reachedAt: string | null;
  result: DeadlineResult;
  days: number;
  originalResult: DeadlineResult;
  waitDays: number;
  statutory: boolean;
  extended: boolean;
}

export interface AuditItem {
  deadlineId: string;
  kind: DeadlineKind;
  contract: { id: string; code: string };
  customer: { id: string; name: string };
  originalDue: string;
  currentDue: string;
  achievedAt: string | null;
  current: { result: DeadlineResult; days: number };
  original: { result: DeadlineResult; days: number };
  extensions: number;
  extensionReasons: string[];
}

export interface ReviewItem {
  task: { id: string; code: string; title: string };
  decision: 'ACCEPT' | 'RETURN';
  enteredAt: string;
  decidedAt: string;
  days: number;
  withinSla: boolean;
}

/** Danh sách tái lập con số của một người (ô bấm ra danh sách). */
export interface CapabilityItems {
  user: Person;
  role: CapabilityRole;
  tasks?: AssistantItem[];
  periods?: PeriodItem[];
  audit?: AuditItem[];
  reviews?: ReviewItem[];
}

@Injectable({ providedIn: 'root' })
export class CapabilityApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/reports/capability`;

  report(query: CapabilityQuery): Observable<CapabilityReport> {
    return this.http.get<CapabilityReport>(this.url, { params: toParams({ ...query }) });
  }

  items(userId: string, query: CapabilityQuery): Observable<CapabilityItems> {
    return this.http.get<CapabilityItems>(`${this.url}/${userId}`, {
      params: toParams({ ...query }),
    });
  }

  /** Excel (cần `reports:export`). */
  exportFile(query: CapabilityQuery): Observable<Blob> {
    return this.http.get(`${this.url}/export`, {
      params: toParams({ ...query }),
      responseType: 'blob',
    });
  }
}
