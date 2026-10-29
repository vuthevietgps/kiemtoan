import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import type { TaskStatus } from '../../tasks/task-labels';
import type { ObligationDisplayStatus, ObligationStatus } from '../deadlines.text';

export interface Obligation {
  id: string;
  customerId: string;
  period: string;
  periodEnd: string;
  dueDate: string;
  originalDueDate: string;
  status: ObligationStatus;
  displayStatus: ObligationDisplayStatus;
  filedAt: string | null;
  filedLate: boolean;
  note: string | null;
  revision: number;
  customer: {
    id: string;
    name: string;
    taxCode: string;
    owner: { id: string; fullName: string } | null;
  };
  obligationType: { id: string; code: string; name: string; group: string; cycle: string };
  receiptDocument: { id: string; fileName: string } | null;
  tasks: { id: string; code: string; title: string; status: TaskStatus; assigneeId: string | null }[];
}

export interface ObligationEvent {
  id: string;
  fromStatus: ObligationStatus | null;
  toStatus: ObligationStatus;
  oldDue: string | null;
  newDue: string | null;
  note: string | null;
  actorName: string | null;
  occurredAt: string;
}

export interface ObligationDetail extends Obligation {
  version: { versionNo: number; legalBasis: string | null } | null;
  events: ObligationEvent[];
}

export interface ObligationSummary {
  notDue: number;
  preparing: number;
  overdue: number;
  filedThisMonth: number;
}

export interface ObligationQuery {
  page: number;
  pageSize: number;
  search: string;
  status: ObligationDisplayStatus | null;
  obligationTypeId: string | null;
  ownerId: string | null;
  customerId: string | null;
}

export interface ObligationSetting {
  id: string;
  code: string;
  name: string;
  cycle: string;
  /** HĐ còn hiệu lực có dịch vụ gắn loại này. */
  byService: boolean;
  setting: { enabled: boolean; reason: string } | null;
}

export interface SettingResult {
  settings: ObligationSetting[];
  synced: { created: number; revived: number; retired: number };
}

/** API lịch báo cáo theo KH (06, I4–I7). */
@Injectable({ providedIn: 'root' })
export class ObligationsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/customer-obligations`;

  list(query: ObligationQuery): Observable<Paginated<Obligation>> {
    return this.http.get<Paginated<Obligation>>(this.url, { params: toParams({ ...query }) });
  }

  summary(query: ObligationQuery): Observable<ObligationSummary> {
    const { search, obligationTypeId, ownerId, customerId } = query;
    return this.http.get<ObligationSummary>(`${this.url}/summary`, {
      params: toParams({ search, obligationTypeId, ownerId, customerId }),
    });
  }

  detail(id: string): Observable<ObligationDetail> {
    return this.http.get<ObligationDetail>(`${this.url}/${id}`);
  }

  prepare(id: string, revision: number, note?: string): Observable<ObligationDetail> {
    return this.http.post<ObligationDetail>(`${this.url}/${id}/prepare`, { revision, note });
  }

  /** Đã nộp: multipart, biên nhận bắt buộc (I7). */
  file(
    id: string,
    revision: number,
    filedAt: string,
    file: File,
    note?: string,
  ): Observable<ObligationDetail> {
    const form = new FormData();
    form.append('revision', String(revision));
    form.append('filedAt', filedAt);
    form.append('file', file, file.name);
    if (note) form.append('note', note);
    return this.http.post<ObligationDetail>(`${this.url}/${id}/file`, form);
  }

  notApplicable(id: string, revision: number, reason: string): Observable<ObligationDetail> {
    return this.http.post<ObligationDetail>(`${this.url}/${id}/not-applicable`, {
      revision,
      reason,
    });
  }

  reopen(id: string, revision: number, reason: string): Observable<ObligationDetail> {
    return this.http.post<ObligationDetail>(`${this.url}/${id}/reopen`, { revision, reason });
  }

  settings(customerId: string): Observable<ObligationSetting[]> {
    return this.http.get<ObligationSetting[]>(
      `${API_URL}/customers/${customerId}/obligation-settings`,
    );
  }

  setSetting(
    customerId: string,
    typeId: string,
    enabled: boolean,
    reason: string,
  ): Observable<SettingResult> {
    return this.http.put<SettingResult>(
      `${API_URL}/customers/${customerId}/obligation-settings/${typeId}`,
      { enabled, reason },
    );
  }

  /** Tải file biên nhận từ kho hồ sơ 02. */
  receipt(documentId: string): Observable<Blob> {
    return this.http.get(`${API_URL}/documents/${documentId}/download`, { responseType: 'blob' });
  }
}
