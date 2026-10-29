import { Role } from '@prisma/client';
import {
  effectivePermissions,
  hasPermission,
  listPermissions,
} from './permissions';
import { customerScope, dataScopeOf, taskScope } from './data-scope';
import { redactFinancialFields } from './financial-fields';
import type { AuthUser } from '../auth/auth-user.interface';

const actor = (role: Role, teamId: string | null = 'team'): AuthUser => ({
  id: 'me',
  email: 'me@test.vn',
  fullName: 'Me',
  role,
  teamId,
});

describe('Default permission matrix', () => {
  it.each([Role.STAFF, Role.ADMIN])(
    '%s cannot read financial information',
    (role) => {
      expect(hasPermission(role, 'finance', 'view')).toBe(false);
      expect(hasPermission(role, 'reports', 'view_financial')).toBe(false);
    },
  );
  it('keeps collection staff out of operational reports and account administration', () => {
    expect(hasPermission(Role.CASHIER, 'reports', 'view_operations')).toBe(
      false,
    );
    expect(hasPermission(Role.CASHIER, 'reports', 'view_financial')).toBe(true);
    expect(hasPermission(Role.CASHIER, 'users', 'update')).toBe(false);
  });
  it('keeps staff out of approvals, user management and secrets by default', () => {
    expect(hasPermission(Role.STAFF, 'contracts', 'approve')).toBe(false);
    expect(hasPermission(Role.STAFF, 'users', 'update')).toBe(false);
    expect(hasPermission(Role.STAFF, 'client-credentials', 'view_secret')).toBe(
      false,
    );
    expect(listPermissions(Role.STAFF)).toContain('tasks:update');
  });
  it('lets only directors publish workflow templates (spec 03 D1)', () => {
    const can = (role: Role, action: 'view' | 'update' | 'approve') =>
      hasPermission(role, 'workflow-templates', action);
    expect(can(Role.DIRECTOR, 'approve')).toBe(true);
    expect(can(Role.MANAGER, 'update')).toBe(true);
    expect(can(Role.MANAGER, 'approve')).toBe(false);
    expect(can(Role.STAFF, 'view')).toBe(true);
    expect(can(Role.STAFF, 'update')).toBe(false);
    expect(can(Role.CASHIER, 'view')).toBe(false);
    expect(can(Role.ADMIN, 'view')).toBe(false);
  });
  it('lets managers and directors confirm execution plans, not staff or cashiers (spec 04 E2)', () => {
    expect(hasPermission(Role.DIRECTOR, 'contracts', 'plan')).toBe(true);
    expect(hasPermission(Role.MANAGER, 'contracts', 'plan')).toBe(true);
    expect(hasPermission(Role.STAFF, 'contracts', 'plan')).toBe(false);
    expect(hasPermission(Role.CASHIER, 'contracts', 'plan')).toBe(false);
  });
  it('uses explicit profile grants and applies financial revocation to all financial endpoints', () => {
    const permissions = effectivePermissions({
      role: Role.MANAGER,
      financialAccess: false,
      secretAccess: false,
    });
    expect(permissions).not.toContain('finance:view');
    expect(
      permissions.some(
        (permission) =>
          permission.startsWith('payments:') ||
          permission.startsWith('invoices:'),
      ),
    ).toBe(false);
    expect(permissions).not.toContain('client-credentials:view_secret');
    const custom = effectivePermissions({
      role: Role.STAFF,
      accessRole: { permissions: ['tasks:view'], deletedAt: null },
      financialAccess: true,
      secretAccess: true,
    });
    expect(custom).toEqual(
      expect.arrayContaining([
        'tasks:view',
        'finance:view',
        'client-credentials:view_secret',
      ]),
    );
    expect(custom).not.toContain('tasks:update');
  });
  it('ignores deleted profiles and honours explicit session grants', () => {
    expect(
      effectivePermissions({
        role: Role.STAFF,
        accessRole: { permissions: ['finance:view'], deletedAt: new Date() },
      }),
    ).not.toContain('finance:view');
    expect(
      hasPermission(
        { ...actor(Role.DIRECTOR), permissions: [] },
        'users',
        'update',
      ),
    ).toBe(false);
  });
});

describe('Record scopes and money serialization', () => {
  it('uses own scope for a manager without a team and NONE for system administration', () => {
    expect(dataScopeOf(actor(Role.MANAGER, null))).toBe('OWN');
    expect(dataScopeOf(actor(Role.ADMIN))).toBe('NONE');
    expect(customerScope(actor(Role.ADMIN))).toEqual({ id: { in: [] } });
    expect(taskScope(actor(Role.ADMIN))).toEqual({ id: { in: [] } });
    expect(customerScope(actor(Role.DIRECTOR))).toEqual({});
    expect(taskScope(actor(Role.DIRECTOR))).toEqual({});
  });
  it('respects profile scopes and retains direct task assignments', () => {
    expect(
      dataScopeOf({ ...actor(Role.MANAGER, null), dataScope: 'TEAM' }),
    ).toBe('OWN');
    expect(taskScope({ ...actor(Role.MANAGER), dataScope: 'OWN' })).toEqual({
      assigneeId: 'me',
    });
    expect(JSON.stringify(customerScope(actor(Role.MANAGER)))).toContain(
      'teamId',
    );
    expect(JSON.stringify(customerScope(actor(Role.STAFF)))).toContain(
      'deletedAt',
    );
    expect(taskScope(actor(Role.MANAGER))).toHaveProperty('OR');
  });
  it('removes money recursively without removing pagination and work counts', () => {
    const input = {
      total: 1,
      items: [
        {
          id: 'contract',
          code: 'HD-1',
          startDate: '2026-10-01',
          total: '999',
          services: [{ unitPrice: '100', amount: '200', quantity: 2 }],
          payments: [{ amount: '10' }],
          installments: [],
          invoices: [],
          paidAmount: '10',
        },
      ],
    };
    expect(redactFinancialFields(input)).toEqual({
      total: 1,
      items: [
        {
          id: 'contract',
          code: 'HD-1',
          startDate: '2026-10-01',
          services: [{ quantity: 2 }],
        },
      ],
    });
    expect(
      redactFinancialFields({
        kpis: { contracts: { total: 9 }, revenue: { value: '100' } },
        serviceStatus: { completed: 3 },
      }),
    ).toEqual({
      kpis: { contracts: { total: 9 } },
      serviceStatus: { completed: 3 },
    });
    expect(input.items[0].total).toBe('999');
  });
});
