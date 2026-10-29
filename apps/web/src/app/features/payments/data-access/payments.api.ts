import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { AgingBucket, ContractStatus, PaymentMethod } from '../../contracts/contract-labels';
import type { PaymentState } from '../payments.text';

export interface PaymentItem {
  id: string;
  code: string;
  amount: string;
  paidDate: string;
  method: PaymentMethod;
  status: PaymentState;
  documentNumber: string | null;
  note: string | null;
  revision: number;
  contract: { id: string; code: string; customer: { id: string; name: string } };
  installment: { id: string; name: string } | null;
  receivedBy: { id: string; fullName: string };
  _count: { documents: number };
}

export interface PaymentEvent {
  id: string;
  fromStatus: PaymentState | null;
  toStatus: PaymentState;
  note: string | null;
  actorName: string | null;
  occurredAt: string;
}

export interface PaymentDetail extends PaymentItem {
  contract: PaymentItem['contract'] & { total: string };
  returnReason: string | null;
  cancelReason: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  migrated: boolean;
  allocations: { amount: string; installment: { id: string; name: string; dueDate: string } }[];
  documents: { id: string; fileName: string }[];
  events: PaymentEvent[];
}

export interface PaymentInput {
  contractId: string;
  installmentId?: string | null;
  amount: string;
  paidDate: string;
  method: PaymentMethod;
  documentNumber?: string | null;
  note?: string | null;
}

export type PaymentPatch = Omit<PaymentInput, 'contractId'>;

export interface PaymentQuery {
  page: number;
  pageSize: number;
  search: string;
  status: PaymentState | null;
  contractId?: string | null;
  from?: string | null;
  to?: string | null;
}

/** Nhóm tuổi nợ (J12): chưa đến hạn hoặc số ngày quá hạn của đợt. */
export type AgingKey = 'notDue' | AgingBucket;
export type AgingTotals = Record<AgingKey, string>;

export interface OpenInstallment {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  remaining: string;
  /** Số ngày đến hạn (âm = quá hạn); null = chờ phát hành BCKT (J10). */
  dueInDays: number | null;
  overdueDays: number | null;
  bucket: AgingBucket | null;
  awaitingMilestone: boolean;
  dueOffsetDays: number | null;
}

export interface ReceivableItem {
  contractId: string;
  code: string;
  customer: { id: string; name: string };
  owner: { id: string; fullName: string } | null;
  status: ContractStatus;
  total: string;
  paid: string;
  remaining: string;
  overdueAmount: string;
  overdueDays: number | null;
  ageBucket: AgingBucket | null;
  pendingAmount: string;
  upcomingAmount: string;
  aging: AgingTotals;
  installments: OpenInstallment[];
}

export interface Receivables {
  items: ReceivableItem[];
  summary: {
    total: string;
    paid: string;
    remaining: string;
    overdueAmount: string;
    pendingAmount: string;
    upcomingAmount: string;
    aging: AgingTotals;
  };
}

export type DueFilter = 'upcoming' | 'overdue';

export interface DueInstallment extends OpenInstallment {
  contract: { id: string; code: string; status: ContractStatus };
  customer: { id: string; name: string };
  owner: { id: string; fullName: string } | null;
  pendingAmount: string;
}

export interface ReceivableQuery {
  search?: string;
  customerId?: string | null;
}

type Moved = { id: string; status: PaymentState };

@Injectable({ providedIn: 'root' })
export class PaymentsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/payments`;

  list(query: PaymentQuery): Observable<Paginated<PaymentItem>> {
    return this.http.get<Paginated<PaymentItem>>(this.url, { params: toParams({ ...query }) });
  }

  detail(id: string): Observable<PaymentDetail> {
    return this.http.get<PaymentDetail>(`${this.url}/${id}`);
  }

  create(input: PaymentInput): Observable<PaymentItem> {
    return this.http.post<PaymentItem>(this.url, input);
  }

  update(id: string, revision: number, patch: PaymentPatch): Observable<{ id: string }> {
    return this.http.patch<{ id: string }>(`${this.url}/${id}`, { ...patch, revision });
  }

  /** Tải file chứng từ mới cho phiếu Nháp / Trả lại (J8). */
  attach(id: string, file: File): Observable<{ documentId: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ documentId: string }>(`${this.url}/${id}/documents`, form);
  }

  detach(id: string, documentId: string): Observable<{ documentId: string }> {
    return this.http.delete<{ documentId: string }>(`${this.url}/${id}/documents/${documentId}`);
  }

  submit(id: string, revision: number): Observable<Moved> {
    return this.http.post<Moved>(`${this.url}/${id}/submit`, { revision });
  }

  withdraw(id: string, revision: number): Observable<Moved> {
    return this.http.post<Moved>(`${this.url}/${id}/withdraw`, { revision });
  }

  approve(id: string, revision: number): Observable<Moved> {
    return this.http.post<Moved>(`${this.url}/${id}/approve`, { revision });
  }

  returnPayment(id: string, revision: number, reason: string): Observable<Moved> {
    return this.http.post<Moved>(`${this.url}/${id}/return`, { revision, reason });
  }

  cancel(id: string, revision: number, reason: string): Observable<Moved> {
    return this.http.post<Moved>(`${this.url}/${id}/cancel`, { revision, reason });
  }

  document(documentId: string): Observable<Blob> {
    return this.http.get(`${API_URL}/documents/${documentId}/download`, { responseType: 'blob' });
  }

  receivables(query: ReceivableQuery): Observable<Receivables> {
    return this.http.get<Receivables>(`${this.url}/receivables`, {
      params: toParams({ ...query }),
    });
  }

  dueInstallments(
    query: ReceivableQuery & { due: DueFilter; days?: number },
  ): Observable<{ items: DueInstallment[]; total: string }> {
    return this.http.get<{ items: DueInstallment[]; total: string }>(
      `${this.url}/receivables/installments`,
      { params: toParams({ ...query }) },
    );
  }

  /** Excel phiếu thu theo bộ lọc danh sách (`payments:export`). */
  exportPayments(query: Partial<PaymentQuery>): Observable<Blob> {
    return this.http.get(`${this.url}/export`, {
      params: toParams({ ...query, page: undefined, pageSize: undefined }),
      responseType: 'blob',
    });
  }

  /** Excel công nợ theo HĐ, có cột tuổi nợ (`payments:export`). */
  exportReceivables(query: ReceivableQuery): Observable<Blob> {
    return this.http.get(`${this.url}/receivables/export`, {
      params: toParams({ ...query }),
      responseType: 'blob',
    });
  }
}
