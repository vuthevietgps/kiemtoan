import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user.interface';

export const APP_MODULES = [
  'dashboard',
  'customers',
  'documents',
  'service-catalog',
  'workflow-templates',
  'contracts',
  'tasks',
  'deadlines',
  'payments',
  'invoices',
  'client-credentials',
  'reports',
  'users',
  'audit-log',
  'settings',
  'notifications',
  'finance',
  'access-control',
] as const;
export type AppModule = (typeof APP_MODULES)[number];
export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'approve',
  'export',
  'view_secret',
  'view_financial',
  'view_operations',
  'manage_access',
  'plan',
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
const MODULE_ACTIONS: Record<AppModule, readonly PermissionAction[]> = {
  dashboard: ['view'],
  customers: ['view', 'create', 'update', 'delete', 'export'],
  documents: ['view', 'create', 'delete'],
  'service-catalog': ['view', 'create', 'update'],
  // Quy trình mẫu (đặc tả 03 D1): approve = phát hành phiên bản, đổi quy trình mặc định.
  'workflow-templates': ['view', 'create', 'update', 'approve'],
  // plan = rà soát/xác nhận kế hoạch thực hiện (đặc tả 04 E2).
  contracts: [
    'view',
    'create',
    'update',
    'delete',
    'approve',
    'export',
    'plan',
  ],
  tasks: ['view', 'create', 'update', 'delete', 'approve', 'export'],
  // 06 (I1, I2): approve = xác nhận loại nghĩa vụ/lịch năm, mở lại nghĩa vụ đã nộp.
  deadlines: ['view', 'create', 'update', 'approve'],
  payments: ['view', 'create', 'delete', 'approve', 'export'],
  invoices: ['view', 'create', 'update', 'delete', 'export'],
  'client-credentials': ['view', 'create', 'update', 'delete', 'view_secret'],
  reports: ['view', 'export', 'view_financial', 'view_operations'],
  users: ['view', 'create', 'update', 'approve', 'manage_access'],
  'audit-log': ['view', 'export'],
  settings: ['view', 'update'],
  notifications: ['view'],
  finance: ['view'],
  'access-control': ['view', 'create', 'update', 'delete'],
};

/** Explicit grants; privileged account operations also enforce actor/target rules. */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  DIRECTOR: [
    'dashboard:view',
    'customers:*',
    'documents:*',
    'service-catalog:*',
    'workflow-templates:*',
    'contracts:*',
    'tasks:*',
    'deadlines:*',
    'payments:*',
    'invoices:*',
    'client-credentials:*',
    'reports:*',
    'users:*',
    'audit-log:view',
    'audit-log:export',
    'settings:*',
    'notifications:view',
    'finance:view',
    'access-control:*',
  ],
  MANAGER: [
    'dashboard:view',
    'customers:*',
    'documents:*',
    'service-catalog:view',
    'workflow-templates:view',
    'workflow-templates:create',
    'workflow-templates:update',
    'contracts:view',
    'contracts:create',
    'contracts:update',
    'contracts:plan',
    'tasks:*',
    'deadlines:view',
    'deadlines:create',
    'deadlines:update',
    'payments:view',
    'invoices:view',
    'invoices:create',
    'client-credentials:*',
    'reports:view',
    'reports:export',
    'reports:view_financial',
    'reports:view_operations',
    'finance:view',
    'users:view',
    'notifications:view',
    'access-control:view',
  ],
  STAFF: [
    'dashboard:view',
    'customers:view',
    'documents:view',
    'documents:create',
    'service-catalog:view',
    'workflow-templates:view',
    'contracts:view',
    'tasks:view',
    'tasks:update',
    'deadlines:view',
    'deadlines:update',
    'client-credentials:view',
    'reports:view',
    'reports:view_operations',
    'notifications:view',
  ],
  CASHIER: [
    'dashboard:view',
    'customers:view',
    'documents:view',
    'service-catalog:view',
    'contracts:view',
    'payments:view',
    'payments:create',
    // 07 (J5): không xoá phiếu thu — rút phiếu chưa duyệt / huỷ có duyệt thay cho xoá.
    'payments:export',
    'invoices:*',
    'reports:view',
    'reports:export',
    'reports:view_financial',
    'finance:view',
    'notifications:view',
  ],
  ADMIN: [
    'users:view',
    'users:create',
    'users:update',
    'users:manage_access',
    'audit-log:view',
    'audit-log:export',
    'settings:*',
    'notifications:view',
    'access-control:view',
  ],
};

export function hasPermission(
  principal: Role | Pick<AuthUser, 'role' | 'permissions'>,
  module: AppModule,
  action: PermissionAction,
): boolean {
  const granted =
    typeof principal === 'string'
      ? ROLE_PERMISSIONS[principal]
      : (principal.permissions ?? ROLE_PERMISSIONS[principal.role]);
  return (
    granted.includes(`${module}:*`) || granted.includes(`${module}:${action}`)
  );
}

export function listPermissions(
  principal: Role | Pick<AuthUser, 'role' | 'permissions'>,
): string[] {
  return APP_MODULES.flatMap((module) =>
    MODULE_ACTIONS[module]
      .filter((action) => hasPermission(principal, module, action))
      .map((action) => `${module}:${action}`),
  );
}

export interface PermissionSource {
  role: Role;
  financialAccess?: boolean | null;
  secretAccess?: boolean | null;
  accessRole?: { permissions: string[]; deletedAt: Date | null } | null;
}

/** The profile replaces the base grants; explicit flags can grant/revoke sensitive access. */
export function effectivePermissions(user: PermissionSource): string[] {
  const base =
    user.accessRole && !user.accessRole.deletedAt
      ? listPermissions({
          role: user.role,
          permissions: user.accessRole.permissions,
        })
      : listPermissions(user.role);
  const result = new Set(base);
  const financial = [
    'finance:view',
    'reports:view_financial',
    'payments:view',
    'invoices:view',
  ];
  if (user.financialAccess === true)
    financial.forEach((permission) => result.add(permission));
  if (user.financialAccess === false) {
    for (const permission of result) {
      if (
        permission.startsWith('payments:') ||
        permission.startsWith('invoices:') ||
        permission === 'finance:view' ||
        permission === 'reports:view_financial'
      )
        result.delete(permission);
    }
  }
  if (user.secretAccess === true) result.add('client-credentials:view_secret');
  if (user.secretAccess === false)
    result.delete('client-credentials:view_secret');
  return [...result].sort();
}
