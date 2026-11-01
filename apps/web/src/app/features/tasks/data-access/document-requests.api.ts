import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';
import { DocumentRequestStatus } from '../task-labels';

export interface DocumentRequestQuery {
  taskId?: string | null;
  customerId?: string | null;
  status?: DocumentRequestStatus | null;
  /** 10-B (M3): nhiều trạng thái — gọi API từng trạng thái rồi gộp (API chỉ lọc một trạng thái). */
  statuses?: DocumentRequestStatus[] | null;
  period?: string | null;
}

/** Nhóm "Chờ khách cung cấp hồ sơ" trên tổng quan (10, M2). */
export const WAITING_STATUSES: DocumentRequestStatus[] = ['REQUESTED', 'NEEDS_SUPPLEMENT'];

export interface DocumentRequestRow {
  id: string;
  customerId: string;
  customerName: string;
  contractId: string | null;
  contractServiceId: string | null;
  period: string | null;
  perPeriod: boolean;
  stepKey: string | null;
  name: string;
  instructions: string | null;
  required: boolean;
  status: DocumentRequestStatus;
  requestedAt: string | null;
  requestMethod: string | null;
  clientDueDate: string | null;
  supplementNote: string | null;
  fileCount: number;
}

/** Hồ sơ yêu cầu của khách (đặc tả 05-D). */
@Injectable({ providedIn: 'root' })
export class DocumentRequestsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/customer-document-requests`;

  list(query: DocumentRequestQuery): Observable<DocumentRequestRow[]> {
    const { statuses, ...rest } = query;
    const one = (status: DocumentRequestStatus | null | undefined) =>
      this.http.get<DocumentRequestRow[]>(this.url, { params: toParams({ ...rest, status }) });
    if (!statuses?.length) return one(rest.status);
    return forkJoin(statuses.map(one)).pipe(map((lists) => lists.flat()));
  }

  markRequested(id: string, body: { method?: string } = {}): Observable<unknown> {
    return this.http.post(`${this.url}/${id}/request`, body);
  }

  upload(id: string, file: File, note?: string): Observable<unknown> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (note) form.append('note', note);
    return this.http.post(`${this.url}/${id}/upload`, form);
  }

  review(id: string): Observable<unknown> {
    return this.http.post(`${this.url}/${id}/review`, {});
  }

  supplement(id: string, note: string): Observable<unknown> {
    return this.http.post(`${this.url}/${id}/supplement`, { note });
  }

  accept(id: string): Observable<unknown> {
    return this.http.post(`${this.url}/${id}/accept`, {});
  }
}
