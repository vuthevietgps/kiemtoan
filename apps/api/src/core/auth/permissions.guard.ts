import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  AppModule,
  hasPermission,
  PermissionAction,
} from '../access-control/permissions';
import { AuthUser } from './auth-user.interface';
import { PERMISSION_KEY } from './decorators/auth.decorators';

/** Kiểm tra quyền khai báo bằng @RequirePermission(). Chạy sau JwtAuthGuard. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      { module: AppModule; action: PermissionAction } | undefined
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user || !hasPermission(user, required.module, required.action)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    const moneyEndpoint =
      required.module === 'payments' ||
      required.module === 'invoices' ||
      (required.module === 'reports' && required.action === 'view_financial') ||
      (required.module === 'contracts' &&
        ['create', 'update', 'delete', 'approve'].includes(required.action));
    if (moneyEndpoint && !hasPermission(user, 'finance', 'view'))
      throw new ForbiddenException(
        'Bạn không có quyền truy cập dữ liệu tài chính',
      );
    if (
      required.action === 'view_secret' &&
      (!user.secretVerifiedAt ||
        user.secretVerifiedAt.getTime() < Date.now() - 5 * 60000)
    ) {
      throw new ForbiddenException({
        code: 'SECRET_REAUTH_REQUIRED',
        message: 'Vui lòng xác nhận lại mật khẩu trước khi xem bí mật',
      });
    }
    return true;
  }
}
