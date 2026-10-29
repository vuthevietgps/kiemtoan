import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { API_URL } from '../api/api';

/** Gắn token vào mọi request; hết phiên (401) thì quay về trang đăng nhập. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!req.url.startsWith(API_URL + '/')) return next(req);
  const token = auth.token();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !/\/auth\/(login|refresh|logout|forgot-password|reset-password|activate|verify-password|change-password)$/.test(req.url)
      ) {
        if (err.error?.code === 'PASSWORD_CHANGE_REQUIRED') return throwError(() => err);
        return from(auth.refresh()).pipe(switchMap((refreshed) => {
          if (refreshed && auth.token()) return next(req.clone({ setHeaders: { Authorization: `Bearer ${auth.token()}` } }));
          if (!auth.token() || auth.token() === token) auth.expire();
          return throwError(() => err);
        }));
      }
      return throwError(() => err);
    }),
  );
};
