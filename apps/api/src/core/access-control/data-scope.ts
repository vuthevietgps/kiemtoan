import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.interface';

/**
 * Phạm vi dữ liệu theo vai trò (tài liệu chức năng, mục 2 và 6.2).
 * Mọi module lọc khách hàng / hợp đồng / công việc đều dùng các hàm ở đây,
 * không tự viết lại điều kiện phân quyền.
 */
export type DataScope = 'ALL' | 'TEAM' | 'OWN' | 'NONE';

export function dataScopeOf(user: AuthUser): DataScope {
  if (user.dataScope)
    return user.dataScope === 'TEAM' && !user.teamId ? 'OWN' : user.dataScope;
  switch (user.role) {
    case Role.DIRECTOR:
    case Role.CASHIER:
      return 'ALL';
    case Role.MANAGER:
      return user.teamId ? 'TEAM' : 'OWN';
    case Role.STAFF:
      return 'OWN';
    default:
      return 'NONE';
  }
}

const NOTHING = { id: { in: [] as string[] } };

/** Khách hàng người dùng được xem. */
export function customerScope(user: AuthUser): Prisma.CustomerWhereInput {
  const scope = dataScopeOf(user);
  if (scope === 'ALL') return {};
  if (scope === 'NONE') return NOTHING;
  if (scope === 'TEAM') {
    return {
      OR: [
        { ownerId: user.id },
        { owner: { teamId: user.teamId } },
        {
          assignments: {
            some: {
              deletedAt: null,
              user: {
                teamId: user.teamId,
                isActive: true,
                deletedAt: null,
                leftAt: null,
              },
            },
          },
        },
        {
          contracts: {
            some: { deletedAt: null, owner: { teamId: user.teamId } },
          },
        },
        {
          contracts: {
            some: {
              deletedAt: null,
              services: { some: { assignee: { teamId: user.teamId } } },
            },
          },
        },
        {
          tasks: {
            some: { deletedAt: null, assignee: { teamId: user.teamId } },
          },
        },
      ],
    };
  }
  return {
    OR: [
      { ownerId: user.id },
      { assignments: { some: { userId: user.id, deletedAt: null } } },
      { contracts: { some: { ownerId: user.id, deletedAt: null } } },
      {
        contracts: {
          some: {
            deletedAt: null,
            services: { some: { assigneeId: user.id } },
          },
        },
      },
      { tasks: { some: { assigneeId: user.id, deletedAt: null } } },
    ],
  };
}

/** Hợp đồng người dùng được xem: thuộc khách hàng trong phạm vi. */
export function contractScope(user: AuthUser): Prisma.ContractWhereInput {
  const scope = dataScopeOf(user);
  if (scope === 'ALL') return {};
  return { customer: customerScope(user) };
}

/** Công việc người dùng được xem. Nhân viên chỉ thấy việc giao cho mình. */
export function taskScope(user: AuthUser): Prisma.TaskWhereInput {
  const scope = dataScopeOf(user);
  if (scope === 'ALL') return {};
  if (scope === 'NONE') return NOTHING;
  if (scope === 'TEAM') {
    return {
      OR: [
        { assigneeId: user.id },
        { assignee: { teamId: user.teamId } },
        { customer: customerScope(user) },
      ],
    };
  }
  return { assigneeId: user.id };
}
