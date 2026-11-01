import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';

/** Bộ lọc đã lưu (M11) và hẹn gửi định kỳ cho chính mình (M12) — 10-F. */
export type ReportKey =
  'revenue' | 'deadline-compliance' | 'contracts' | 'customers' | 'capability';
export type ScheduleFrequency = 'WEEKLY' | 'MONTHLY';
export type FilterParams = Record<string, string | null | undefined>;

export interface SavedSchedule {
  frequency: ScheduleFrequency;
  enabled: boolean;
  lastSentAt: string | null;
  lastResult: 'SENT' | 'NOT_EMAILED' | 'FAILED' | 'STOPPED' | null;
  stoppedReason: string | null;
}

export interface SavedFilter {
  id: string;
  report: ReportKey;
  name: string;
  params: Record<string, string>;
  schedule: SavedSchedule | null;
}

@Injectable({ providedIn: 'root' })
export class SavedFiltersApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/reports/saved-filters`;

  list(report: ReportKey): Observable<SavedFilter[]> {
    return this.http.get<SavedFilter[]>(this.url, { params: toParams({ report }) });
  }

  get(id: string): Observable<SavedFilter> {
    return this.http.get<SavedFilter>(`${this.url}/${id}`);
  }

  create(report: ReportKey, name: string, params: FilterParams): Observable<SavedFilter> {
    return this.http.post<SavedFilter>(this.url, { report, name, params });
  }

  updateParams(id: string, params: FilterParams): Observable<SavedFilter> {
    return this.http.patch<SavedFilter>(`${this.url}/${id}`, { params });
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${this.url}/${id}`);
  }

  saveSchedule(id: string, frequency: ScheduleFrequency): Observable<SavedFilter> {
    return this.http.put<SavedFilter>(`${this.url}/${id}/schedule`, { frequency, enabled: true });
  }

  removeSchedule(id: string): Observable<SavedFilter> {
    return this.http.delete<SavedFilter>(`${this.url}/${id}/schedule`);
  }

  /** Excel theo bộ lọc; kỳ truyền vào là kỳ của lượt gửi định kỳ. */
  exportFile(id: string, period: { from: string; to: string }): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/export`, {
      params: toParams({ ...period }),
      responseType: 'blob',
    });
  }
}
