import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../api/api';

export interface AccountProfile { id: string; email: string; fullName: string; phone: string | null; title: string | null }
export interface AccountSession { id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; lastUsedAt: string; current: boolean }
@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/auth`;
  profile() { return this.http.get<AccountProfile>(`${this.url}/profile`); }
  updateProfile(data: Pick<AccountProfile, 'fullName' | 'phone' | 'title'>) { return this.http.patch<AccountProfile>(`${this.url}/profile`, data); }
  changePassword(currentPassword: string, password: string) { return this.http.post(`${this.url}/change-password`, { currentPassword, password }); }
  sessions() { return this.http.get<AccountSession[]>(`${this.url}/sessions`); }
  revoke(id?: string) { return this.http.delete(`${this.url}/sessions${id ? '/' + id : ''}`); }
  forgot(email: string) { return this.http.post<{ message: string }>(`${this.url}/forgot-password`, { email }); }
  reset(mode: 'activate' | 'reset-password', token: string, password: string) { return this.http.post(`${this.url}/${mode}`, { token, password }); }
  verify(password: string) { return this.http.post(`${this.url}/verify-password`, { password }); }
}
