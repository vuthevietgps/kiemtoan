import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../api/api';

export type Role = 'DIRECTOR' | 'MANAGER' | 'STAFF' | 'CASHIER' | 'ADMIN';

export const ROLE_LABELS: Record<Role, string> = {
  DIRECTOR: 'Giám đốc',
  MANAGER: 'Kế toán trưởng / Trưởng nhóm',
  STAFF: 'Nhân viên nghiệp vụ',
  CASHIER: 'Kế toán thu tiền',
  ADMIN: 'Quản trị hệ thống',
};

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  teamId: string | null;
  mustChangePassword?: boolean;
}

interface SessionResponse {
  user: SessionUser;
  permissions: string[];
}

const TOKEN_KEY = 'ketoan.token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Phiên đăng nhập. Quyền chỉ để ẩn/hiện giao diện — backend luôn kiểm tra lại. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenSignal = signal<string | null>(readToken());
  private readonly session = signal<SessionResponse | null>(null);
  private refreshing?: Promise<boolean>;
  private epoch = 0;
  private refreshTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.refreshTimer));
  }

  readonly token = this.tokenSignal.asReadonly();
  readonly user = computed(() => this.session()?.user ?? null);
  readonly permissions = computed(() => new Set(this.session()?.permissions ?? []));
  readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });

  async login(email: string, password: string): Promise<void> {
    this.clear();
    const res = await this.withRefreshLock(() => firstValueFrom(
      this.http.post<SessionResponse & { accessToken: string }>(`${API_URL}/auth/login`, {
        email,
        password,
      }, { withCredentials: true }),
    ));
    this.setToken(res.accessToken);
    this.session.set({ user: res.user, permissions: res.permissions });
  }

  /** Nạp lại phiên khi mở trang (token còn trong trình duyệt). */
  async restore(): Promise<boolean> {
    if (this.session()) return true;
    if (!this.tokenSignal()) return this.refresh();
    try {
      this.session.set(await firstValueFrom(this.http.get<SessionResponse>(`${API_URL}/auth/me`)));
      return true;
    } catch {
      return this.refresh();
    }
  }

  /**
   * Kiểm tra quyền dạng 'module:action', ví dụ can('contracts:approve'). 'a|b' = có một trong các
   * quyền (dùng cho route/menu gộp nhiều phần có quyền khác nhau).
   */
  can(permission: string): boolean {
    const granted = this.permissions();
    return permission.split('|').some((p) => granted.has(p));
  }

  logout(): void {
    void this.withRefreshLock(() => firstValueFrom(this.http.post(`${API_URL}/auth/logout`, {}, { withCredentials: true }))).catch(() => undefined);
    this.expire();
  }

  expire(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }

  refresh(): Promise<boolean> {
    if (this.refreshing) return this.refreshing;
    const epoch = this.epoch;
    this.refreshing = this.withRefreshLock(() => firstValueFrom(this.http.post<SessionResponse & { accessToken: string }>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })))
      .then((response) => {
        if (epoch !== this.epoch) return false;
        this.setToken(response.accessToken);
        this.session.set({ user: response.user, permissions: response.permissions });
        return true;
      }).catch(() => { if (epoch === this.epoch) this.clear(); return false; })
      .finally(() => { this.refreshing = undefined; });
    return this.refreshing;
  }

  home(): string {
    if (this.user()?.mustChangePassword) return '/account';
    if (this.can('dashboard:view')) return '/dashboard';
    if (this.can('users:view')) return '/users';
    return '/account';
  }

  async reloadSession(): Promise<void> {
    this.session.set(await firstValueFrom(this.http.get<SessionResponse>(`${API_URL}/auth/me`)));
  }

  private clear(): void {
    this.epoch++;
    this.setToken(null);
    this.session.set(null);
  }

  private setToken(token: string | null): void {
    clearTimeout(this.refreshTimer);
    this.tokenSignal.set(token);
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
        const epoch = this.epoch;
        if (payload.exp) this.refreshTimer = setTimeout(() => { void this.refresh().then((ok) => { if (!ok && epoch === this.epoch) this.expire(); }); }, Math.max(1000, payload.exp * 1000 - Date.now() - 60000));
      } catch { /* Opaque test/legacy tokens are restored through the server. */ }
    }
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Trình duyệt chặn localStorage: vẫn chạy được, chỉ mất phiên khi tải lại trang.
    }
  }

  private async withRefreshLock<T>(action: () => Promise<T>): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request('ketoan-session-refresh', action);
    return action();
  }
}
