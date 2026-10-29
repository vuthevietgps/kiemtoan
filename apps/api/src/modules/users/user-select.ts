import { Prisma } from '@prisma/client';
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  title: true,
  role: true,
  teamId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  financialAccess: true,
  secretAccess: true,
  accessRoleId: true,
  mustChangePassword: true,
  activatedAt: true,
  leftAt: true,
  lockedUntil: true,
  team: { select: { id: true, name: true } },
  accessRole: { select: { id: true, name: true, scope: true } },
  accessRequests: {
    where: { status: 'PENDING' },
    select: { id: true, proposal: true, createdAt: true },
  },
} satisfies Prisma.UserSelect;
export type PublicUser = Prisma.UserGetPayload<{
  select: typeof USER_PUBLIC_SELECT;
}>;
