import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

const response = { accessToken: 'access-1', user: { id: 'admin', email: 'admin@test.vn', fullName: 'Admin', role: 'ADMIN', teamId: null }, permissions: ['users:view'] };
let auth: AuthService; let http: HttpTestingController;
const router = { navigate: vi.fn().mockResolvedValue(true), navigateByUrl: vi.fn().mockResolvedValue(true) };
beforeEach(() => {
  localStorage.removeItem('ketoan.token'); vi.clearAllMocks();
  TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), { provide: Router, useValue: router }] });
  auth = TestBed.inject(AuthService); http = TestBed.inject(HttpTestingController);
});
afterEach(() => { http.verify(); localStorage.removeItem('ketoan.token'); });
async function signIn(): Promise<void> {
  const pending = auth.login('admin@test.vn', 'Password@123');
  const request = http.expectOne('/api/v1/auth/login');
  expect(request.request.withCredentials).toBe(true); request.flush(response); await pending;
}

describe('Session state and landing routes', () => {
  it('sends system administrators to users and initial-password accounts to account settings', async () => {
    await signIn(); expect(auth.home()).toBe('/users'); expect(auth.can('finance:view')).toBe(false);
    const pending = auth.refresh(); http.expectOne('/api/v1/auth/refresh').flush({ ...response, user: { ...response.user, mustChangePassword: true } });
    await pending; expect(auth.home()).toBe('/account');
  });
  it('accepts "a|b" as any-of permissions for routes and menu items', async () => {
    await signIn();
    expect(auth.can('settings:view|users:view')).toBe(true);
    expect(auth.can('settings:view|deadlines:view')).toBe(false);
  });
  it('shares one refresh request across concurrent callers', async () => {
    const first = auth.refresh(); const second = auth.refresh(); expect(second).toBe(first);
    const request = http.expectOne('/api/v1/auth/refresh'); expect(request.request.withCredentials).toBe(true);
    request.flush(response); expect(await first).toBe(true); expect(await second).toBe(true); expect(auth.token()).toBe('access-1');
  });
  it('revokes the server session on logout and clears local permissions immediately', async () => {
    await signIn(); auth.logout();
    expect(auth.token()).toBeNull(); expect(auth.user()).toBeNull(); expect(auth.permissions().size).toBe(0);
    expect(router.navigate).toHaveBeenCalledWith(['/login']); http.expectOne('/api/v1/auth/logout').flush({});
  });
  it('does not restore a logged-out user when an earlier refresh finishes late', async () => {
    const pending = auth.refresh();
    const refresh = http.expectOne('/api/v1/auth/refresh');
    auth.logout(); http.expectOne('/api/v1/auth/logout').flush({});
    refresh.flush(response); expect(await pending).toBe(false); expect(auth.token()).toBeNull(); expect(auth.user()).toBeNull();
  });
  it('does not clear a newer login when an older refresh fails', async () => {
    const refresh = auth.refresh(); const stale = http.expectOne('/api/v1/auth/refresh');
    const next = auth.login('admin@test.vn', 'Password@123');
    http.expectOne('/api/v1/auth/login').flush({ ...response, accessToken: 'new-login' }); await next;
    stale.flush({}, { status: 401, statusText: 'Expired' }); expect(await refresh).toBe(false); expect(auth.token()).toBe('new-login');
  });
});

describe('Authentication HTTP interceptor', () => {
  it('never sends the access token to external URLs', async () => {
    await signIn(); const pending = firstValueFrom(TestBed.inject(HttpClient).get('https://example.com/resource'));
    const request = http.expectOne('https://example.com/resource'); expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({}); await pending;
  });
  it('refreshes once and retries a protected request with the new token', async () => {
    await signIn(); const pending = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/customers'));
    const first = http.expectOne('/api/v1/customers'); expect(first.request.headers.get('Authorization')).toBe('Bearer access-1');
    first.flush({}, { status: 401, statusText: 'Expired' });
    http.expectOne('/api/v1/auth/refresh').flush({ ...response, accessToken: 'access-2' });
    await vi.waitFor(() => expect(auth.token()).toBe('access-2'));
    const retry = http.expectOne('/api/v1/customers'); expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ items: [] }); expect(await pending).toEqual({ items: [] });
  });
  it('keeps an initial-password session so the user can reach the change-password screen', async () => {
    await signIn(); const pending = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/customers')).catch((error: unknown) => error);
    http.expectOne('/api/v1/customers').flush({ code: 'PASSWORD_CHANGE_REQUIRED' }, { status: 401, statusText: 'Change password' });
    await pending; expect(auth.token()).toBe('access-1'); http.expectNone('/api/v1/auth/refresh'); expect(router.navigate).not.toHaveBeenCalled();
  });
});
