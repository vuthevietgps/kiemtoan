import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import type { PaymentState } from '../../payments/payments.text';
import {
  BillingCycle,
  ContractStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '../contract-labels';

export interface UserRef {
  id: string;
  fullName: string;
}

export interface ContractListItem {
  id: string;
  code: string;
  customer: { id: string; name: string };
  owner: UserRef | null;
  serviceTypes: string[];
  subtotal: string;
  vatAmount: string;
  total: string;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  paidAmount: string;
  paymentStatus: PaymentStatus;
}

export type TaskGenerationStatus = 'PENDING' | 'GENERATING' | 'DONE' | 'SKIPPED' | 'FAILED';

export interface ContractServiceLine {
  id: string;
  serviceTypeId: string;
  /** `issuesAuditReport`: dịch vụ phát hành BCKT (04-F) — trang HĐ hiện tab Kiểm toán. */
  serviceType: {
    id: string;
    code: string;
    name: string;
    cycle: BillingCycle;
    issuesAuditReport?: boolean;
  };
  description: string | null;
  period: string | null;
  quantity: number;
  unitPrice: string;
  amount: string;
  status: string;
  assigneeId: string | null;
  assignee: UserRef | null;
  taskGenerationStatus: TaskGenerationStatus;
  taskGenerationMessage: string | null;
  /** Kế hoạch thực hiện của dòng (04-B), null khi chưa lập. */
  plan: { id: string; status: 'DRAFT' | 'CONFIRMED' } | null;
}

/** 07 J10: hạn theo ngày cố định hoặc N ngày sau phát hành BCKT của HĐ. */
export type InstallmentDueRule = 'FIXED_DATE' | 'AFTER_REPORT_ISSUE';

export interface InstallmentInput {
  name: string;
  amount: string;
  /** Hạn cố định; với đợt theo mốc BCKT là ngày dự kiến. */
  dueDate: string;
  dueRule?: InstallmentDueRule;
  dueOffsetDays?: number | null;
}

export interface Installment {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  dueRule: InstallmentDueRule;
  dueOffsetDays: number | null;
  /** Ngày phát hành BCKT dùng tính hạn; null khi đang chờ. */
  milestoneDate: string | null;
  /** Đang chờ phát hành BCKT (chưa có hạn, không quá hạn). */
  awaitingMilestone: boolean;
  overdueDays: number | null;
  paidAmount: string;
}

export interface ContractPayment {
  id: string;
  code: string;
  amount: string;
  paidDate: string;
  method: PaymentMethod;
  /** 07-C: chi tiết HĐ không trả phiếu Đã huỷ. */
  status: PaymentState;
  documentNumber: string | null;
  note: string | null;
  receivedBy: UserRef;
  installment: { id: string; name: string } | null;
}

export interface ContractInvoice {
  id: string;
  number: string | null;
  symbol: string | null;
  issueDate: string | null;
  subtotal: string;
  vatAmount: string;
  total: string;
  status: InvoiceStatus;
  note: string | null;
  requestedBy: UserRef;
  createdAt: string;
}

export interface ContractDetail {
  id: string;
  code: string;
  customerId: string;
  customer: { id: string; name: string; taxCode: string; address: string | null };
  ownerId: string | null;
  owner: UserRef | null;
  approvedBy: UserRef | null;
  approvedAt: string | null;
  returnedReason: string | null;
  returnedAt: string | null;
  signedDate: string | null;
  startDate: string;
  endDate: string | null;
  vatRate: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  status: ContractStatus;
  note: string | null;
  salesOwnerId: string | null;
  salesOwner: UserRef | null;
  referrerName: string | null;
  referrerPhone: string | null;
  referrerNote: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledBy: UserRef | null;
  renewedFrom: { id: string; code: string } | null;
  renewals: { id: string; code: string; status: ContractStatus }[];
  services: ContractServiceLine[];
  installments: Installment[];
  payments: ContractPayment[];
  invoices: ContractInvoice[];
  paidAmount: string;
  /** J2: tiền phiếu Chờ duyệt, chưa tính đã thu. */
  pendingAmount: string;
  /** 07-D2: tiền các đợt quá hạn (quy tắc công nợ chung). */
  overdueAmount: string;
  remainingAmount: string;
  paymentStatus: PaymentStatus;
  invoicedSubtotal: string;
  taskProgress: { total: number; done: number };
}

export interface ContractInput {
  customerId: string;
  ownerId?: string | null;
  signedDate?: string | null;
  startDate: string;
  endDate?: string | null;
  vatRate: number;
  note?: string | null;
  salesOwnerId?: string | null;
  referrerName?: string | null;
  referrerPhone?: string | null;
  referrerNote?: string | null;
  services: {
    serviceTypeId: string;
    description?: string | null;
    period?: string | null;
    quantity: number;
    unitPrice: string;
    assigneeId?: string | null;
  }[];
  installments: InstallmentInput[];
}

export interface ContractQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: ContractStatus | null;
  customerId?: string | null;
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

@Injectable({ providedIn: 'root' })
export class ContractsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/contracts`;

  list(query: ContractQuery): Observable<Paginated<ContractListItem>> {
    return this.http.get<Paginated<ContractListItem>>(this.url, { params: toParams({ ...query }) });
  }

  get(id: string): Observable<ContractDetail> {
    return this.http.get<ContractDetail>(`${this.url}/${id}`);
  }

  create(input: ContractInput): Observable<ContractDetail> {
    return this.http.post<ContractDetail>(this.url, input);
  }

  update(id: string, input: ContractInput): Observable<ContractDetail> {
    return this.http.patch<ContractDetail>(`${this.url}/${id}`, input);
  }

  submit(id: string): Observable<unknown> {
    return this.http.post(`${this.url}/${id}/submit`, {});
  }

  returnToDraft(id: string, reason: string): Observable<unknown> {
    return this.http.post(`${this.url}/${id}/return`, { reason });
  }

  regenerateTasks(id: string): Observable<unknown> {
    return this.http.post(`${this.url}/${id}/generate-tasks`, {});
  }

  approve(id: string): Observable<unknown> {
    return this.http.post(`${this.url}/${id}/approve`, {});
  }

  changeStatus(id: string, status: ContractStatus, reason?: string): Observable<unknown> {
    return this.http.post(`${this.url}/${id}/status`, reason ? { status, reason } : { status });
  }

  /** Danh sách khách hàng để chọn (module customers). */
  customerOptions(): Observable<CustomerOption[]> {
    return this.http.get<CustomerOption[]>(`${API_URL}/customers/options`);
  }

  userOptions(): Observable<UserOption[]> {
    return this.http.get<UserOption[]>(`${API_URL}/users/options`);
  }
}
