import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { InvoiceStatus } from '../../contracts/contract-labels';
import type { InvoiceKind } from '../invoices.text';

export interface InvoiceBuyer {
  buyerName: string | null;
  buyerTaxCode: string | null;
  buyerAddress: string | null;
  buyerEmail: string | null;
}

export interface InvoiceItem extends InvoiceBuyer {
  id: string;
  kind: InvoiceKind;
  templateCode: string | null;
  symbol: string | null;
  number: string | null;
  issueDate: string | null;
  subtotal: string;
  vatAmount: string;
  total: string;
  status: InvoiceStatus;
  note: string | null;
  reason: string | null;
  migrated: boolean;
  revision: number;
  createdAt: string;
  contract: {
    id: string;
    code: string;
    customer: { id: string; name: string; taxCode: string };
  };
  requestedBy: { id: string; fullName: string };
  installments: { installment: { id: string; name: string; dueDate: string } }[];
  _count: { documents: number };
}

export interface RelatedInvoice {
  id: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  templateCode: string | null;
  symbol: string | null;
  number: string | null;
  issueDate: string | null;
  subtotal: string;
  total: string;
}

export interface InvoiceDetail extends InvoiceItem {
  lookupCode: string | null;
  taxAuthorityCode: string | null;
  issuedByName: string | null;
  related: RelatedInvoice | null;
  derived: RelatedInvoice[];
  documents: { id: string; fileName: string; mimeType: string }[];
  events: {
    id: string;
    toStatus: InvoiceStatus;
    note: string | null;
    actorName: string | null;
    occurredAt: string;
  }[];
}

export interface InvoiceQuery {
  page: number;
  pageSize: number;
  search: string;
  status: InvoiceStatus | null;
  kind: InvoiceKind | null;
  contractId?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface InvoiceRequestInput extends Partial<InvoiceBuyer> {
  contractId: string;
  installmentIds?: string[];
  subtotal?: string;
  note?: string;
}

/** Thông tin hoá đơn đã xuất (K5) và file; thêm trường của điều chỉnh / thay thế. */
export interface InvoiceRecordInput {
  templateCode: string;
  symbol: string;
  number: string;
  issueDate: string;
  lookupCode?: string;
  taxAuthorityCode?: string;
  pdf: File;
  xml?: File | null;
  direction?: 'INCREASE' | 'DECREASE';
  subtotal?: string;
  reason?: string;
  buyerName?: string;
  buyerTaxCode?: string;
  buyerAddress?: string;
}

export interface ReconciliationQuery {
  search?: string;
  customerId?: string | null;
  to?: string | null;
  mismatchOnly?: boolean;
}

export interface ReconciliationRow {
  contractId: string;
  code: string;
  customer: { id: string; name: string; taxCode: string };
  total: string;
  paid: string;
  invoiced: string;
  requested: string;
  paidNotInvoiced: string;
  invoicedNotPaid: string;
}

export interface Reconciliation {
  items: ReconciliationRow[];
  summary: Omit<ReconciliationRow, 'contractId' | 'code' | 'customer'>;
}

function formData(revision: number, input: InvoiceRecordInput): FormData {
  const form = new FormData();
  form.append('revision', String(revision));
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    if (value instanceof File) form.append(key, value, value.name);
    else form.append(key, String(value));
  }
  return form;
}

@Injectable({ providedIn: 'root' })
export class InvoicesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/invoices`;

  list(query: InvoiceQuery): Observable<Paginated<InvoiceItem>> {
    return this.http.get<Paginated<InvoiceItem>>(this.url, { params: toParams({ ...query }) });
  }

  detail(id: string): Observable<InvoiceDetail> {
    return this.http.get<InvoiceDetail>(`${this.url}/${id}`);
  }

  request(input: InvoiceRequestInput): Observable<InvoiceDetail> {
    return this.http.post<InvoiceDetail>(this.url, input);
  }

  update(id: string, revision: number, buyer: Partial<InvoiceBuyer> & { note?: string | null }) {
    return this.http.patch<InvoiceDetail>(`${this.url}/${id}`, { ...buyer, revision });
  }

  cancel(id: string, revision: number, reason: string): Observable<InvoiceDetail> {
    return this.http.post<InvoiceDetail>(`${this.url}/${id}/cancel`, { revision, reason });
  }

  issue(id: string, revision: number, input: InvoiceRecordInput): Observable<InvoiceDetail> {
    return this.http.post<InvoiceDetail>(`${this.url}/${id}/issue`, formData(revision, input));
  }

  adjust(id: string, revision: number, input: InvoiceRecordInput): Observable<InvoiceDetail> {
    return this.http.post<InvoiceDetail>(`${this.url}/${id}/adjust`, formData(revision, input));
  }

  replace(id: string, revision: number, input: InvoiceRecordInput): Observable<InvoiceDetail> {
    return this.http.post<InvoiceDetail>(`${this.url}/${id}/replace`, formData(revision, input));
  }

  /** 08 K8: đối chiếu thu – xuất theo HĐ. */
  reconciliation(query: ReconciliationQuery): Observable<Reconciliation> {
    return this.http.get<Reconciliation>(`${this.url}/reconciliation`, {
      params: toParams({ ...query }),
    });
  }

  exportInvoices(query: Partial<InvoiceQuery>): Observable<Blob> {
    return this.http.get(`${this.url}/export`, {
      params: toParams({ ...query, page: undefined, pageSize: undefined }),
      responseType: 'blob',
    });
  }

  exportReconciliation(query: ReconciliationQuery): Observable<Blob> {
    return this.http.get(`${this.url}/reconciliation/export`, {
      params: toParams({ ...query }),
      responseType: 'blob',
    });
  }

  document(documentId: string): Observable<Blob> {
    return this.http.get(`${API_URL}/documents/${documentId}/download`, { responseType: 'blob' });
  }
}
