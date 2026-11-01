import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';

/** Kỳ + lọc một khách hàng (báo cáo vận hành 10-C). */
export interface OperationsQuery {
  from: string;
  to: string;
  customerId?: string | null;
}

export type ComplianceOutcome = 'ON_TIME' | 'LATE' | 'OVERDUE' | 'NOT_DUE';

export interface ComplianceCounts {
  onTime: number;
  late: number;
  overdue: number;
  notDue: number;
  clientDelay: number;
  onTimeRate: number | null;
}

/** M6: tuân thủ deadline theo lịch báo cáo 06 và việc pháp lý. */
export interface DeadlineComplianceReport {
  from: string;
  to: string;
  summary: ComplianceCounts;
  byMonth: (ComplianceCounts & { month: string })[];
  byCustomer: (ComplianceCounts & { customerId: string; name: string })[];
  items: {
    kind: 'OBLIGATION' | 'TASK';
    id: string;
    title: string;
    customerId: string;
    customerName: string;
    dueDate: string;
    doneOn: string | null;
    outcome: ComplianceOutcome;
    daysLate: number;
    clientDelay: boolean;
  }[];
}

export type ContractCategory = 'NEW' | 'ACTIVE' | 'EXPIRING' | 'ENDED' | 'RENEWED';

/** M7: hợp đồng mới / hiệu lực / sắp hết hạn / tái ký. `subtotal` chỉ có khi có quyền tài chính. */
export interface ContractsReport {
  from: string;
  to: string;
  expiringDays: number;
  summary: {
    newApproved: number;
    active: number;
    expiring: number;
    ended: number;
    renewed: number;
    renewalRate: number | null;
  };
  items: {
    id: string;
    code: string;
    status: string;
    customerId: string;
    customerName: string;
    ownerName: string | null;
    approvedOn: string | null;
    startDate: string | null;
    endDate: string | null;
    renewedBy: string[];
    subtotal?: string;
    categories: ContractCategory[];
  }[];
}

/** M8: khách hàng mới / ngừng / giữ chân. */
export interface CustomersReport {
  from: string;
  to: string;
  summary: {
    newCustomers: number;
    stopped: number;
    activeAtStart: number;
    activeAtEnd: number;
    retained: number;
    retentionRate: number | null;
  };
  items: {
    id: string;
    name: string;
    taxCode: string;
    ownerName: string | null;
    firstApprovedOn: string | null;
    stoppedOn: string | null;
    isNew: boolean;
    stopped: boolean;
    activeAtStart: boolean;
    activeAtEnd: boolean;
    retained: boolean;
  }[];
}

export type OperationsReport = 'deadline-compliance' | 'contracts' | 'customers';

@Injectable({ providedIn: 'root' })
export class OperationsReportsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/reports`;

  deadlineCompliance(query: OperationsQuery): Observable<DeadlineComplianceReport> {
    return this.http.get<DeadlineComplianceReport>(`${this.url}/deadline-compliance`, {
      params: toParams({ ...query }),
    });
  }

  contracts(query: OperationsQuery): Observable<ContractsReport> {
    return this.http.get<ContractsReport>(`${this.url}/contracts`, {
      params: toParams({ ...query }),
    });
  }

  customers(query: OperationsQuery): Observable<CustomersReport> {
    return this.http.get<CustomersReport>(`${this.url}/customers`, {
      params: toParams({ ...query }),
    });
  }

  /** Excel (cần `reports:export`; máy chủ ghi nhật ký EXPORT). */
  exportFile(report: OperationsReport, query: OperationsQuery): Observable<Blob> {
    return this.http.get(`${this.url}/${report}/export`, {
      params: toParams({ ...query }),
      responseType: 'blob',
    });
  }
}
