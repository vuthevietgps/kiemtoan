import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  detail: unknown;
  createdAt: string;
  user: { id: string; fullName: string; email: string } | null;
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  userId?: string | null;
  entity?: string | null;
  action?: string | null;
  from?: string;
  to?: string;
}

export const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: 'Thêm', color: 'green' },
  UPDATE: { label: 'Sửa', color: 'blue' },
  DELETE: { label: 'Xoá', color: 'red' },
  APPROVE: { label: 'Duyệt', color: 'purple' },
  LOGIN: { label: 'Đăng nhập', color: 'default' },
  VIEW_SECRET: { label: 'Xem mật khẩu', color: 'orange' },
};

export const ENTITY_LABELS: Record<string, string> = {
  auth: 'Đăng nhập',
  users: 'Người dùng',
  customers: 'Khách hàng',
  documents: 'Hồ sơ, tài liệu',
  'service-catalog': 'Dịch vụ',
  'service-types': 'Dịch vụ',
  'workflow-templates': 'Quy trình mẫu',
  'workflow-versions': 'Quy trình mẫu',
  contracts: 'Hợp đồng',
  tasks: 'Công việc',
  deadlines: 'Lịch & Deadline',
  payments: 'Thu tiền',
  invoices: 'Hoá đơn',
  'client-credentials': 'Tài khoản công ty',
  notifications: 'Thông báo',
  settings: 'Cài đặt',
};

@Injectable({ providedIn: 'root' })
export class AuditLogApi {
  private readonly http = inject(HttpClient);

  list(query: AuditLogQuery): Observable<Paginated<AuditLogEntry>> {
    return this.http.get<Paginated<AuditLogEntry>>(`${API_URL}/audit-logs`, {
      params: toParams({ ...query }),
    });
  }

  entities(): Observable<string[]> {
    return this.http.get<string[]>(`${API_URL}/audit-logs/entities`);
  }

  users(): Observable<{ id: string; fullName: string }[]> {
    return this.http.get<{ id: string; fullName: string }[]>(`${API_URL}/users/options`);
  }
  export(query: AuditLogQuery): Observable<Blob> {
    return this.http.get(`${API_URL}/audit-logs/export`, { params: toParams({ ...query }), responseType: 'blob' });
  }
}
