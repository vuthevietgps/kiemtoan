import type { Prisma } from '@prisma/client';
import { effectivePermissions } from '../access-control/permissions';
import type { AuthUser } from './auth-user.interface';

type UserWithRole = Prisma.UserGetPayload<{ include: { accessRole: true } }>;

export function toAuthUser(user: UserWithRole): AuthUser {
  const scope =
    user.accessRole?.deletedAt === null ? user.accessRole.scope : undefined;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    teamId: user.teamId,
    mustChangePassword: user.mustChangePassword,
    permissions: effectivePermissions(user),
    authVersion: user.authVersion,
    ...(scope && ['ALL', 'TEAM', 'OWN', 'NONE'].includes(scope)
      ? { dataScope: scope as AuthUser['dataScope'] }
      : {}),
  };
}
