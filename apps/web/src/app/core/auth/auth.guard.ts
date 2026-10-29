import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Chưa đăng nhập → về trang đăng nhập. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.restore()) ? true : router.createUrlTree(['/login']);
};

/**
 * Chặn route theo quyền: { canActivate: [permissionGuard], data: { permission: 'contracts:view' } }.
 * Không có quyền → về trang Tổng quan.
 */
export const permissionGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restore();
  if (auth.user()?.mustChangePassword) return router.createUrlTree(['/account']);
  const permission = route.data['permission'] as string | undefined;
  return !permission || auth.can(permission) ? true : router.createUrlTree([auth.home()]);
};
