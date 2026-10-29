import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import {
  AccountingRegime,
  CustomerStatus,
  DocumentCategory,
  PitPeriod,
  TaxPeriod,
  VatMethod,
} from '../customer-labels';

export interface UserRef {
  id: string;
  fullName: string;
}

export interface Customer {
  id: string;
  name: string;
  taxCode: string;
  address: string | null;
  legalRep: string | null;
  businessType: string | null;
  taxPeriod: TaxPeriod;
  fiscalYearEndMonth: number;
  vatMethod: VatMethod | null;
  pitPeriod: PitPeriod | null;
  accountingRegime: AccountingRegime | null;
  taxAuthority: string | null;
  status: CustomerStatus;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  note: string | null;
  ownerId: string | null;
  owner: UserRef | null;
  createdAt: string;
}

export interface CustomerListItem extends Customer {
  contractCount: number;
}

export interface ContractSummary {
  id: string;
  code: string;
  status: string;
  total: string;
  startDate: string;
}

export interface CustomerDetail extends Customer {
  contracts: ContractSummary[];
  documentCount: number;
  openTaskCount: number;
  tasks?: { id: string; title: string; status: string; dueDate: string | null }[];
}

export type CustomerInput = Partial<
  Omit<Customer, 'id' | 'owner' | 'createdAt'>
> & { name: string; taxCode: string };

export interface CustomerQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: CustomerStatus | null;
  ownerId?: string | null;
}

export interface CustomerOption {
  id: string;
  name: string;
  taxCode: string;
}

export interface UserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface CustomerDocument {
  id: string;
  version: number;
  customerId: string;
  category: DocumentCategory;
  period: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  note: string | null;
  createdAt: string;
  uploadedBy: UserRef;
  contract: { id: string; code: string } | null;
  task: { id: string; title: string } | null;
}

export interface UploadDocumentInput {
  category: DocumentCategory;
  contractId?: string | null;
  period?: string | null;
  note?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/customers`;

  list(query: CustomerQuery): Observable<Paginated<CustomerListItem>> {
    return this.http.get<Paginated<CustomerListItem>>(this.url, { params: toParams({ ...query }) });
  }

  options(): Observable<CustomerOption[]> {
    return this.http.get<CustomerOption[]>(`${this.url}/options`);
  }

  get(id: string): Observable<CustomerDetail> {
    return this.http.get<CustomerDetail>(`${this.url}/${id}`);
  }

  create(input: CustomerInput): Observable<Customer> {
    return this.http.post<Customer>(this.url, input);
  }

  update(id: string, input: Partial<CustomerInput>): Observable<Customer> {
    return this.http.patch<Customer>(`${this.url}/${id}`, input);
  }

  remove(id: string): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(`${this.url}/${id}`);
  }

  /** Người phụ trách: dùng API chung của module users. */
  userOptions(): Observable<UserOption[]> {
    return this.http.get<Paginated<UserOption>>(`${this.url}/assignee-options`, { params: { page: 1, pageSize: 100 } }).pipe(map(result => result.items));
  }

}
