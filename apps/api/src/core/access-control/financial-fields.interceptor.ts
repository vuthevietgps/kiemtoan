import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, Observable } from 'rxjs';
import type { AuthUser } from '../auth/auth-user.interface';
import { hasPermission } from './permissions';
import { redactFinancialFields } from './financial-fields';

@Injectable()
export class FinancialFieldsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (
      !request.user ||
      !/^\/api\/v1\/(contracts|customers|dashboard|service-catalog|service-types|tasks)(\/|$)/.test(
        request.path,
      )
    )
      return next.handle();
    const user = request.user;
    return next.handle().pipe(
      map((data: unknown) => {
        const result = hasPermission(user, 'finance', 'view')
          ? data
          : redactFinancialFields(data);
        if (
          request.path.endsWith('/dashboard') &&
          !hasPermission(user, 'tasks', 'view') &&
          result &&
          typeof result === 'object'
        ) {
          return Object.fromEntries(
            Object.entries(result).filter(
              ([key]) =>
                ![
                  'myTasks',
                  'myTaskItems',
                  'upcoming',
                  'reportDeadlines',
                ].includes(key),
            ),
          );
        }
        return result;
      }),
    );
  }
}
