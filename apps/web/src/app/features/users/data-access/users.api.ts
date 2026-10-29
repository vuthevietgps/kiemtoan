import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { Role } from '../../../core/auth/auth.service';

export interface Team {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  title: string | null;
  role: Role;
  teamId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  team: Team | null;
  accessRoleId: string | null;
  financialAccess: boolean | null;
  secretAccess: boolean | null;
  accessRole: { id: string; name: string; scope: string } | null;
  accessRequests: { id: string; proposal: AccessProposal; createdAt: string }[];
  mustChangePassword: boolean;
  activatedAt: string | null;
  leftAt: string | null;
  lockedUntil: string | null;
}

export interface UserQuery {
  page: number;
  pageSize: number;
  search?: string;
  role?: Role | null;
  teamId?: string | null;
  status?: string | null;
}

export interface UserPayload {
  fullName: string;
  role: Role;
  email?: string;
  password?: string;
  teamId?: string | null;
  title?: string | null;
  phone?: string | null;
  accessRoleId?: string | null;
  financialAccess?: boolean | null;
  secretAccess?: boolean | null;
}

export interface AccessRole { id: string; name: string; baseRole: Role; scope: string; permissions: string[] }
export interface AccessProposal { role: Role; accessRoleId?: string | null; financialAccess?: boolean | null; secretAccess?: boolean | null }
export interface AccessRequest { id: string; status: string; createdAt: string; proposal: AccessProposal; reason: string | null; user: Pick<User, 'id' | 'fullName' | 'email' | 'role'>; requestedBy: { fullName: string }; reviewedBy: { fullName: string } | null }
export interface AccountLink { link?: string; expiresAt: string; emailSent: boolean }
export interface PermissionCatalog { role: Role; permissions: string[] }

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/users`;

  list(query: UserQuery): Observable<Paginated<User>> {
    return this.http.get<Paginated<User>>(this.url, { params: toParams({ ...query }) });
  }

  teams(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.url}/teams`);
  }

  /** Danh sách gọn mọi người dùng đang hoạt động (cho bộ lọc). */
  options(): Observable<{ id: string; fullName: string }[]> {
    return this.http.get<{ id: string; fullName: string }[]>(`${this.url}/options`);
  }

  create(payload: UserPayload): Observable<User> {
    return this.http.post<User>(this.url, payload);
  }

  update(id: string, payload: UserPayload): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}`, payload);
  }

  setActive(id: string, active: boolean): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}/${active ? 'unlock' : 'lock'}`, {});
  }

  roles(): Observable<AccessRole[]> { return this.http.get<AccessRole[]>(`${this.url}/access-roles`); }
  catalog(): Observable<PermissionCatalog[]> { return this.http.get<PermissionCatalog[]>(`${this.url}/permission-catalog`); }
  requests(page = 1, status: string | null = 'PENDING'): Observable<Paginated<AccessRequest>> { return this.http.get<Paginated<AccessRequest>>(`${this.url}/access-requests`, { params: toParams({ page, pageSize: 20, status }) }); }
  review(id: string, approve: boolean, reason: string): Observable<unknown> { return this.http.post(`${this.url}/access-requests/${id}/review`, { approve, reason }); }
  saveRole(payload: Omit<AccessRole, 'id'>, id?: string): Observable<AccessRole> { return id ? this.http.patch<AccessRole>(`${this.url}/access-roles/${id}`, payload) : this.http.post<AccessRole>(`${this.url}/access-roles`, payload); }
  deleteRole(id: string): Observable<unknown> { return this.http.delete(`${this.url}/access-roles/${id}`); }
  saveTeam(name: string, id?: string): Observable<Team> { return id ? this.http.patch<Team>(`${this.url}/teams/${id}`, { name }) : this.http.post<Team>(`${this.url}/teams`, { name }); }
  deleteTeam(id: string): Observable<unknown> { return this.http.delete(`${this.url}/teams/${id}`); }
  accountLink(id: string, purpose: 'invite' | 'password-reset'): Observable<AccountLink> { return this.http.post<AccountLink>(`${this.url}/${id}/${purpose}`, {}); }
  revoke(id: string): Observable<unknown> { return this.http.post(`${this.url}/${id}/revoke-sessions`, {}); }
  leave(id: string): Observable<User> { return this.http.post<User>(`${this.url}/${id}/leave`, {}); }
}
