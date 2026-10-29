import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

export function userScope(actor: AuthUser): Prisma.UserWhereInput {
  if (actor.role === Role.ADMIN || actor.role === Role.DIRECTOR) return {};
  if (actor.role === Role.MANAGER && actor.teamId)
    return { OR: [{ id: actor.id }, { teamId: actor.teamId }] };
  return { id: actor.id };
}
export async function lockUserManagement(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(1840291)::text`;
}
export async function protectLastAccount(
  tx: Prisma.TransactionClient,
  old: { id: string; role: Role; isActive: boolean },
  role: Role,
  active: boolean,
): Promise<void> {
  if (
    !old.isActive ||
    ![Role.ADMIN, Role.DIRECTOR].includes(old.role as 'ADMIN' | 'DIRECTOR') ||
    (active && role === old.role)
  )
    return;
  const others = await tx.user.count({
    where: {
      id: { not: old.id },
      role: old.role,
      isActive: true,
      deletedAt: null,
      leftAt: null,
      OR: [{ mustChangePassword: false }, { activatedAt: { not: null } }],
    },
  });
  if (!others)
    throw new BadRequestException(
      'Không thể vô hiệu tài khoản quản trị hoặc giám đốc hoạt động cuối cùng',
    );
}
export function protectSelfAccess(actor: AuthUser, targetId: string): void {
  if (actor.id === targetId)
    throw new ForbiddenException(
      'Không thể tự thay đổi vai trò hoặc quyền của mình',
    );
}
export async function revokeUserSessions(
  tx: Prisma.TransactionClient,
  userId: string,
  resetInitialPassword = false,
): Promise<void> {
  const target = resetInitialPassword
    ? await tx.user.findUnique({
        where: { id: userId },
        select: { mustChangePassword: true },
      })
    : null;
  await tx.user.update({
    where: { id: userId },
    data: {
      authVersion: { increment: 1 },
      ...(target?.mustChangePassword
        ? {
            passwordHash: await bcrypt.hash(
              randomBytes(48).toString('hex'),
              12,
            ),
          }
        : {}),
    },
  });
  await tx.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await tx.userActionToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}
