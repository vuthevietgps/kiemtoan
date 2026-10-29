import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { InvoiceStatus } from '../../contracts/contract-labels';

export interface InvoiceItem {
  id: string;
  number: string | null;
  symbol: string | null;
  issueDate: string | null;
  subtotal: string;
  vatAmount: string;
  total: string;
  status: InvoiceStatus;
  note: string | null;
  createdAt: string;
  contract: {
    id: string;
    code: string;
    customer: { id: string; name: string; taxCode: string };
  };
  requestedBy: { id: string; fullName: string };
}

export interface InvoiceQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: InvoiceStatus | null;
  contractId?: string | null;
}

export interface IssueInput {
  number: string;
  symbol: string;
  issueDate: string;
}

@Injectable({ providedIn: 'root' })
export class InvoicesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/invoices`;

  list(query: InvoiceQuery): Observable<Paginated<InvoiceItem>> {
    return this.http.get<Paginated<InvoiceItem>>(this.url, { params: toParams({ ...query }) });
  }

  request(contractId: string, subtotal: string | null, note: string | null): Observable<InvoiceItem> {
    return this.http.post<InvoiceItem>(this.url, {
      contractId,
      ...(subtotal ? { subtotal } : {}),
      ...(note ? { note } : {}),
    });
  }

  issue(id: string, input: IssueInput): Observable<InvoiceItem> {
    return this.http.patch<InvoiceItem>(`${this.url}/${id}/issue`, input);
  }

  cancel(id: string): Observable<InvoiceItem> {
    return this.http.patch<InvoiceItem>(`${this.url}/${id}/cancel`, {});
  }
}
