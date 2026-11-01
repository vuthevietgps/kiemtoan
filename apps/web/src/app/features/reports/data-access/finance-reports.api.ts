import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';

export type RevenueGroup = 'serviceType' | 'customer' | 'owner' | 'month';
export type Measure = 'contractValue' | 'invoiced' | 'paid';

export const GROUP_OPTIONS: { value: RevenueGroup; label: string }[] = [
  { value: 'serviceType', label: 'Loại dịch vụ' },
  { value: 'customer', label: 'Khách hàng' },
  { value: 'owner', label: 'Người phụ trách' },
  { value: 'month', label: 'Tháng' },
];

export const MEASURES: { key: Measure; label: string; hint: string }[] = [
  { key: 'contractValue', label: 'Giá trị HĐ', hint: 'trước VAT, theo ngày duyệt' },
  { key: 'invoiced', label: 'Đã xuất hoá đơn', hint: 'trước VAT, hoá đơn hiệu lực theo ngày lập' },
  { key: 'paid', label: 'Đã thu', hint: 'gồm VAT, phiếu đã duyệt theo ngày tiền về' },
];

export interface MeasureRow {
  contracts: number;
  contractValue: string;
  /** null khi nhóm theo loại dịch vụ (hoá đơn / phiếu thu không gắn dịch vụ). */
  invoiced: string | null;
  paid: string | null;
  previous: Record<Measure, string | null>;
  change: Record<Measure, number | null>;
}

interface DetailKeys {
  contractId: string;
  contractCode: string;
  customerId: string;
  customerName: string;
  ownerId: string;
  month: string;
  date: string;
  amount: string;
}

/** Báo cáo Doanh thu (10-D, M4–M5). */
export interface RevenueMeasuresReport {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  groupBy: RevenueGroup;
  rows: (MeasureRow & { key: string; name: string })[];
  totals: MeasureRow;
  details: {
    contracts: (DetailKeys & { serviceTypeIds: string[] })[];
    invoices: (DetailKeys & { id: string; kind: string; identity: string })[];
    payments: (DetailKeys & { id: string; code: string })[];
  };
}

@Injectable({ providedIn: 'root' })
export class FinanceReportsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/reports/revenue`;

  revenue(query: {
    from: string;
    to: string;
    groupBy: RevenueGroup;
  }): Observable<RevenueMeasuresReport> {
    return this.http.get<RevenueMeasuresReport>(this.url, { params: toParams({ ...query }) });
  }

  exportFile(query: { from: string; to: string; groupBy: RevenueGroup }): Observable<Blob> {
    return this.http.get(`${this.url}/export`, {
      params: toParams({ ...query }),
      responseType: 'blob',
    });
  }
}
