import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated } from '../../../core/api/api';
import { ContractStatus } from '../contract-labels';

export type AmendmentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';
export type AmendmentAction = 'ADD' | 'UPDATE' | 'REMOVE';

export interface AmendmentLine {
  id: string;
  action: AmendmentAction;
  contractServiceId: string | null;
  serviceTypeId: string | null;
  serviceType: { id: string; code: string; name: string } | null;
  description: string | null;
  period: string | null;
  quantity: number | null;
  /** Ẩn với người không có quyền xem tài chính. */
  unitPrice?: string | null;
  amount?: string | null;
}

export interface ScheduleItem {
  id?: string;
  name: string;
  amount: string;
  dueDate: string;
}

export interface AmendmentSnapshot {
  subtotal?: string;
  vatAmount?: string;
  total?: string;
}

export interface Amendment {
  id: string;
  number: number;
  code: string;
  title: string;
  content: string | null;
  effectiveDate: string | null;
  status: AmendmentStatus;
  subtotal?: string;
  vatAmount?: string;
  total?: string;
  installments?: ScheduleItem[];
  before?: AmendmentSnapshot | null;
  after?: AmendmentSnapshot | null;
  returnedReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  lines: AmendmentLine[];
}

export interface AmendmentLineInput {
  action: AmendmentAction;
  contractServiceId?: string;
  serviceTypeId?: string;
  description?: string;
  period?: string;
  quantity?: number;
  unitPrice?: string;
  assigneeId?: string;
}

export interface AmendmentInput {
  title: string;
  content?: string | null;
  effectiveDate?: string | null;
  lines: AmendmentLineInput[];
}

export interface BusinessInfoInput {
  ownerId?: string | null;
  salesOwnerId?: string | null;
  referrerName?: string | null;
  referrerPhone?: string | null;
  referrerNote?: string | null;
  signedDate?: string | null;
  note?: string | null;
}

export interface HistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  user: { id: string; fullName: string } | null;
  detail: Record<string, unknown>;
}

export interface ExpiringContract {
  id: string;
  code: string;
  status: ContractStatus;
  endDate: string;
  daysLeft: number;
  customer: { id: string; name: string };
  owner: { id: string; fullName: string } | null;
  renewals: { id: string; code: string; status: ContractStatus }[];
}

/** Vòng đời HĐ (04-D): thông tin kinh doanh, tái ký, sắp hết hạn, lịch sử, phụ lục. */
@Injectable({ providedIn: 'root' })
export class ContractLifecycleApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/contracts`;

  updateBusinessInfo(id: string, input: BusinessInfoInput): Observable<unknown> {
    return this.http.patch(`${this.url}/${id}/business-info`, input);
  }

  renew(id: string): Observable<{ id: string; code: string }> {
    return this.http.post<{ id: string; code: string }>(`${this.url}/${id}/renew`, {});
  }

  expiring(days = 30): Observable<{ days: number; items: ExpiringContract[] }> {
    return this.http.get<{ days: number; items: ExpiringContract[] }>(`${this.url}/expiring`, {
      params: { days },
    });
  }

  history(id: string, page: number): Observable<Paginated<HistoryEntry>> {
    return this.http.get<Paginated<HistoryEntry>>(`${this.url}/${id}/history`, {
      params: { page, pageSize: 20 },
    });
  }

  amendments(id: string): Observable<Amendment[]> {
    return this.http.get<Amendment[]>(`${this.url}/${id}/amendments`);
  }

  saveAmendment(id: string, input: AmendmentInput, amendmentId?: string): Observable<Amendment> {
    return amendmentId
      ? this.http.put<Amendment>(`${this.url}/${id}/amendments/${amendmentId}`, input)
      : this.http.post<Amendment>(`${this.url}/${id}/amendments`, input);
  }

  amendmentAction(
    id: string,
    amendmentId: string,
    action: 'submit' | 'cancel' | 'approve',
  ): Observable<Amendment> {
    return this.http.post<Amendment>(`${this.url}/${id}/amendments/${amendmentId}/${action}`, {});
  }

  returnAmendment(id: string, amendmentId: string, reason: string): Observable<Amendment> {
    return this.http.post<Amendment>(`${this.url}/${id}/amendments/${amendmentId}/return`, {
      reason,
    });
  }
}
