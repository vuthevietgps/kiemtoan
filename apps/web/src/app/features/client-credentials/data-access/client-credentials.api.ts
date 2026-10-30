import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { CredentialStatus, CredentialType } from '../../customers/customer-labels';
import type {
  CredentialEventType,
  CredentialKind,
  TokenCustody,
  TokenProvider,
} from '../client-credentials.text';

export interface Person {
  id: string;
  fullName: string;
}

/** Một tài khoản / token như API trả — không bao giờ có mật khẩu (chỉ cờ `hasSecret`). */
export interface ClientCredential {
  id: string;
  customerId: string;
  type: CredentialType;
  label: string | null;
  url: string | null;
  username: string | null;
  expiresAt: string | null;
  status: CredentialStatus;
  statusNote: string | null;
  note: string | null;
  provider: TokenProvider | null;
  serialNumber: string | null;
  custody: TokenCustody | null;
  storageLocation: string | null;
  holder: Person | null;
  loanedAt: string | null;
  loanDueAt: string | null;
  loanPurpose: string | null;
  secretChangedAt: string | null;
  secretChangedBy: Person | null;
  hasSecret: boolean;
  daysToExpiry: number | null;
  loanOverdue: boolean;
  /** Phiên bản dữ liệu, gửi lại khi ghi (409 nếu đã cũ). */
  revision: number;
  updatedAt: string;
  customer: { id: string; name: string; taxCode: string };
  updatedBy: Person | null;
}

export interface CredentialEvent {
  id: string;
  type: CredentialEventType;
  note: string | null;
  detail: Record<string, unknown> | null;
  occurredAt: string;
  actor: Person | null;
}

export interface CredentialDetail extends ClientCredential {
  history: CredentialEvent[];
}

export interface CredentialInput {
  customerId?: string;
  type?: CredentialType;
  label?: string | null;
  url?: string | null;
  username?: string | null;
  /** Bỏ trống khi sửa = giữ mật khẩu / PIN cũ. */
  password?: string;
  expiresAt?: string | null;
  status?: CredentialStatus;
  note?: string | null;
  provider?: TokenProvider | null;
  serialNumber?: string | null;
  storageLocation?: string | null;
}

export interface CredentialQuery {
  page: number;
  pageSize: number;
  /** Bỏ trống = cả tài khoản cổng và token (đếm cảnh báo). */
  kind?: CredentialKind;
  customerId?: string | null;
  type?: CredentialType | null;
  status?: CredentialStatus | null;
  custody?: TokenCustody | null;
  expiring?: boolean;
  overdueLoan?: boolean;
  search?: string;
}

export type SecretPurpose = 'VIEW' | 'COPY';

@Injectable({ providedIn: 'root' })
export class ClientCredentialsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/client-credentials`;

  list(query: CredentialQuery): Observable<Paginated<ClientCredential>> {
    const { expiring, overdueLoan, ...rest } = query;
    return this.http.get<Paginated<ClientCredential>>(this.url, {
      params: toParams({
        ...rest,
        ...(expiring && { expiring: true }),
        ...(overdueLoan && { overdueLoan: true }),
      }),
    });
  }

  detail(id: string): Observable<CredentialDetail> {
    return this.http.get<CredentialDetail>(`${this.url}/${id}`);
  }

  accessLog(id: string): Observable<{ items: CredentialEvent[] }> {
    return this.http.get<{ items: CredentialEvent[] }>(`${this.url}/${id}/access-log`);
  }

  create(input: CredentialInput): Observable<CredentialDetail> {
    return this.http.post<CredentialDetail>(this.url, input);
  }

  update(id: string, input: CredentialInput & { revision: number }): Observable<CredentialDetail> {
    return this.http.patch<CredentialDetail>(`${this.url}/${id}`, input);
  }

  remove(id: string, revision: number, reason: string): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(`${this.url}/${id}`, { body: { revision, reason } });
  }

  /** Giải mã mật khẩu / PIN — máy chủ ghi nhật ký mỗi lần gọi (L6). */
  secret(id: string, purpose: SecretPurpose): Observable<{ password: string }> {
    return this.http.post<{ password: string }>(`${this.url}/${id}/secret`, { purpose });
  }

  /** Người nhận token khi giao (máy chủ kiểm quyền / phạm vi KH). */
  users(): Observable<Person[]> {
    return this.http.get<Person[]>(`${API_URL}/users/options`);
  }

  /** Lệnh có `revision`: báo lỗi, mượn, trả, giao, đặt nơi giữ (L4, L7). */
  command(id: string, action: CredentialCommand, body: object): Observable<CredentialDetail> {
    return this.http.post<CredentialDetail>(`${this.url}/${id}/${action}`, body);
  }
}

export type CredentialCommand = 'report-issue' | 'borrow' | 'return' | 'hand-over' | 'custody';
