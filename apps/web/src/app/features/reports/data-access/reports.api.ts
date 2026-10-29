import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';

export type RevenueGroupBy = 'serviceType' | 'customer' | 'owner' | 'month';

export const GROUP_BY_OPTIONS: { value: RevenueGroupBy; label: string }[] = [
  { value: 'serviceType', label: 'Loại dịch vụ' },
  { value: 'customer', label: 'Khách hàng' },
  { value: 'owner', label: 'Người phụ trách' },
  { value: 'month', label: 'Tháng' },
];

export type PeriodQuery = {
  from?: string;
  to?: string;
};

export interface RevenueReport {
  from: string;
  to: string;
  groupBy: RevenueGroupBy;
  rows: { key: string; name: string; contracts: number; subtotal: string; total: string }[];
  totals: { contracts: number; subtotal: string; total: string };
}

export interface ReceivablesReport {
  rows: {
    customerId: string;
    customerName: string;
    taxCode: string;
    contracts: number;
    total: string;
    paid: string;
    remaining: string;
    overdue: string;
  }[];
  totals: { total: string; paid: string; remaining: string; overdue: string };
}

export interface ComplianceStat {
  onTime: number;
  late: number;
  overdueOpen: number;
  onTimeRate: number | null;
}

export interface ComplianceReport {
  from: string;
  to: string;
  byMonth: (ComplianceStat & { month: string })[];
  byStaff: (ComplianceStat & { userId: string; name: string })[];
  totals: ComplianceStat;
}

export interface StaffPerformanceReport {
  from: string;
  to: string;
  rows: {
    userId: string;
    fullName: string;
    role: string;
    teamName: string | null;
    tasksDone: number;
    onTime: number;
    late: number;
    onTimeRate: number | null;
    customers: number;
    revenue: string;
  }[];
}

type QueryValue = string | number | undefined;

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  revenue(query: PeriodQuery & { groupBy: RevenueGroupBy }): Observable<RevenueReport> {
    return this.get('revenue', query);
  }

  receivables(): Observable<ReceivablesReport> {
    return this.get('receivables', {});
  }

  taskCompliance(query: PeriodQuery): Observable<ComplianceReport> {
    return this.get('task-compliance', query);
  }

  staffPerformance(query: PeriodQuery): Observable<StaffPerformanceReport> {
    return this.get('staff-performance', query);
  }

  /** Link tải CSV trực tiếp (kèm token vì trình duyệt không gửi header Authorization). */
  csvUrl(report: string, query: Record<string, QueryValue>): string {
    const params = new URLSearchParams(
      toParams({ ...query, format: 'csv', token: this.auth.token() ?? '' }),
    );
    return `${API_URL}/reports/${report}?${params.toString()}`;
  }

  private get<T>(report: string, query: Record<string, QueryValue>): Observable<T> {
    return this.http.get<T>(`${API_URL}/reports/${report}`, { params: toParams(query) });
  }
}
