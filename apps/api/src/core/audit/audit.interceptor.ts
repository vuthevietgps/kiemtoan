import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, mergeMap } from 'rxjs';
import { AuthUser } from '../auth/auth-user.interface';
import { AuditService } from './audit.service';

const ACTION_BY_METHOD: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/**
 * Tự ghi nhật ký cho mọi request thay đổi dữ liệu (POST/PUT/PATCH/DELETE) thành công.
 * Hành động đặc biệt (duyệt, xem mật khẩu) do service tự ghi thêm qua AuditService.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const action =
      ACTION_BY_METHOD[request.method] ??
      (request.method === 'GET' &&
      (/\/(download|preview)$/.test(request.path) ||
        request.query['format'] === 'csv' ||
        request.path.endsWith('/export'))
        ? 'EXPORT'
        : undefined);
    if (!action || !request.user) return next.handle();

    const path = request.path.replace(/^\/api\/v1\//, '');
    const entity = path.split('/')[0] ?? 'unknown';
    const params = request.params;
    const userId = request.user.id;

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        const resultId =
          result && typeof result === 'object' && 'id' in result
            ? String(result.id)
            : null;
        const entityId =
          typeof params['id'] === 'string' ? params['id'] : resultId;
        await this.audit.log(userId, action, entity, entityId, {
          method: request.method,
          path,
        });
        return result;
      }),
    );
  }
}
