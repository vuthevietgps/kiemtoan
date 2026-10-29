import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';
import { AppModule, PermissionAction } from '../../access-control/permissions';
import { AuthUser } from '../auth-user.interface';

export const IS_PUBLIC_KEY = 'isPublic';
export const PERMISSION_KEY = 'requiredPermission';

/** Endpoint không cần đăng nhập. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Khai báo quyền cần có, ví dụ @RequirePermission('contracts', 'approve'). */
export const RequirePermission = (
  module: AppModule,
  action: PermissionAction,
) => SetMetadata(PERMISSION_KEY, { module, action });

/** Lấy người dùng đang đăng nhập trong controller. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthUser }>();
    return request.user;
  },
);
