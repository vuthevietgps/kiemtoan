import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { CredentialStatus, CredentialType } from '../../customers/customer-labels';

export interface ClientCredential {
  id: string;
  customerId: string;
  type: CredentialType;
  label: string | null;
  url: string | null;
  username: string;
  expiresAt: string | null;
  status: CredentialStatus;
  note: string | null;
  updatedAt: string;
  customer: { id: string; name: string; taxCode: string };
  updatedBy: { id: string; fullName: string } | null;
}

export interface CredentialInput {
  customerId?: string;
  type: CredentialType;
  label?: string | null;
  url?: string | null;
  username: string;
  /** Bỏ trống khi sửa = giữ mật khẩu cũ. */
  password?: string;
  expiresAt?: string | null;
  status: CredentialStatus;
  note?: string | null;
}

export interface CredentialQuery {
  page: number;
  pageSize: number;
  customerId?: string | null;
  type?: CredentialType | null;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientCredentialsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/client-credentials`;

  list(query: CredentialQuery): Observable<Paginated<ClientCredential>> {
    return this.http.get<Paginated<ClientCredential>>(this.url, { params: toParams({ ...query }) });
  }

  create(input: CredentialInput): Observable<ClientCredential> {
    return this.http.post<ClientCredential>(this.url, input);
  }

  update(id: string, input: CredentialInput): Observable<ClientCredential> {
    return this.http.patch<ClientCredential>(`${this.url}/${id}`, input);
  }

  remove(id: string): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(`${this.url}/${id}`);
  }

  /** Giải mã mật khẩu — backend ghi nhật ký mỗi lần gọi. */
  reveal(id: string): Observable<{ password: string }> {
    return this.http.post<{ password: string }>(`${this.url}/${id}/reveal`, {});
  }
}

/** Chữ ký số còn ≤ 30 ngày (hoặc đã hết hạn) thì cảnh báo. */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
