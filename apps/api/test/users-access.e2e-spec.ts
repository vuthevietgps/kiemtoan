import {
  createTestContext,
  TestContext,
  TEST_PASSWORD,
} from './utils/test-app';
import { login, relogin } from './utils/auth-flow';
import request from 'supertest';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});

describe('Atomic account safeguards', () => {
  it('rolls back user creation if the requested role profile is invalid', async () => {
    await ctx
      .api(ctx.users.admin)
      .post('/users')
      .send({
        email: 'rollback@test.vn',
        fullName: 'Must roll back',
        role: 'MANAGER',
        accessRoleId: '00000000-0000-4000-8000-000000000001',
      })
      .expect(400);
    expect(
      await ctx.prisma.user.count({ where: { email: 'rollback@test.vn' } }),
    ).toBe(0);
    const before = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.users.admin.id },
    });
    await ctx
      .api(ctx.users.admin)
      .patch(`/users/${ctx.users.admin.id}`)
      .send({ fullName: 'Should not apply', role: 'DIRECTOR' })
      .expect(403);
    expect(
      (
        await ctx.prisma.user.findUniqueOrThrow({
          where: { id: ctx.users.admin.id },
        })
      ).fullName,
    ).toBe(before.fullName);
  });
  it('serializes concurrent locks so at least one usable administrator remains', async () => {
    const original = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.users.admin.id },
    });
    const backup = await ctx.prisma.user.create({
      data: {
        email: 'backup-admin@test.vn',
        fullName: 'Backup admin',
        role: 'ADMIN',
        passwordHash: original.passwordHash,
      },
    });
    const results = await Promise.all([
      ctx.api(ctx.users.director).patch(`/users/${original.id}/lock`),
      ctx.api(ctx.users.director).patch(`/users/${backup.id}/lock`),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    expect(
      await ctx.prisma.user.count({
        where: { role: 'ADMIN', isActive: true, leftAt: null },
      }),
    ).toBe(1);
    await ctx
      .api(ctx.users.director)
      .patch(`/users/${original.id}/unlock`)
      .expect(200);
    await ctx
      .api(ctx.users.director)
      .patch(`/users/${backup.id}/unlock`)
      .expect(200);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${backup.id}/leave`)
      .expect(201);
    await relogin(ctx, ctx.users.admin);
  });
});
afterAll(async () => {
  await ctx.app.close();
});

describe('User visibility and profile isolation', () => {
  it('limits list/detail/options/teams to the manager team', async () => {
    const list = await ctx.api(ctx.users.manager).get('/users').expect(200);
    const body = list.body as { items: { id: string }[]; total: number };
    expect(body.total).toBe(2);
    expect(body.items.map((user) => user.id)).toEqual(
      expect.arrayContaining([ctx.users.staff.id, ctx.users.manager.id]),
    );
    await ctx
      .api(ctx.users.manager)
      .get(`/users/${ctx.users.staff2.id}`)
      .expect(404);
    const options = await ctx
      .api(ctx.users.staff)
      .get('/users/options')
      .expect(200);
    expect((options.body as { id: string }[]).map((user) => user.id)).toEqual([
      ctx.users.staff.id,
    ]);
    const teams = await ctx
      .api(ctx.users.staff)
      .get('/users/teams')
      .expect(200);
    expect((teams.body as { id: string }[]).map((team) => team.id)).toEqual([
      ctx.users.staff.teamId,
    ]);
  });
  it('does not expose password hashes or session/token data through user lists', async () => {
    const response = await ctx.api(ctx.users.admin).get('/users').expect(200);
    const text = JSON.stringify(response.body);
    for (const key of [
      'passwordHash',
      'refreshHash',
      'tokenHash',
      'secretVerifiedAt',
    ])
      expect(text).not.toContain(key);
    await ctx.api(ctx.users.staff).get('/users').expect(403);
    await ctx.api(ctx.users.admin).get('/dashboard').expect(403);
  });
  it('ignores role injection in self-profile updates and restricts query tokens', async () => {
    await ctx
      .api(ctx.users.staff)
      .patch('/auth/profile')
      .send({ fullName: 'Staff', role: 'DIRECTOR' })
      .expect(400);
    await ctx
      .api(ctx.users.staff)
      .patch('/auth/profile')
      .send({
        fullName: 'Staff updated',
        phone: '0901234567',
        title: 'Kế toán',
      })
      .expect(200);
    const me = await ctx.api(ctx.users.staff).get('/auth/me').expect(200);
    expect(
      (me.body as { user: { role: string; fullName: string } }).user,
    ).toMatchObject({ role: 'STAFF', fullName: 'Staff updated' });
    await request(ctx.app.getHttpServer())
      .get(`/api/v1/users?token=${ctx.users.admin.token}`)
      .expect(401);
  });
});

describe('Approval of elevated access', () => {
  it('keeps old grants until the director approves, then invalidates old sessions', async () => {
    const request = await ctx
      .api(ctx.users.admin)
      .post(`/users/${ctx.users.staff.id}/access-requests`)
      .send({ role: 'STAFF', financialAccess: true, secretAccess: false })
      .expect(201);
    const id = (request.body as { requestId: string }).requestId;
    const before = await ctx.api(ctx.users.staff).get('/auth/me').expect(200);
    expect(
      (before.body as { permissions: string[] }).permissions,
    ).not.toContain('finance:view');
    await ctx
      .api(ctx.users.admin)
      .post(`/users/access-requests/${id}/review`)
      .send({ approve: true, reason: 'Admin tự duyệt' })
      .expect(403);
    const approved = await Promise.all([
      ctx
        .api(ctx.users.director)
        .post(`/users/access-requests/${id}/review`)
        .send({ approve: true, reason: 'Cần theo dõi công nợ được giao' }),
      ctx
        .api(ctx.users.director)
        .post(`/users/access-requests/${id}/review`)
        .send({ approve: true, reason: 'Cần theo dõi công nợ được giao' }),
    ]);
    expect(approved.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    await ctx.api(ctx.users.staff).get('/auth/me').expect(401);
    await relogin(ctx, ctx.users.staff);
    const after = await ctx.api(ctx.users.staff).get('/auth/me').expect(200);
    expect((after.body as { permissions: string[] }).permissions).toContain(
      'finance:view',
    );
    expect(
      await ctx.prisma.auditLog.count({
        where: { action: 'ACCESS_APPROVE', entityId: ctx.users.staff.id },
      }),
    ).toBe(1);
  });
});

describe('Privilege escalation guards', () => {
  it('rejects self-elevation, duplicates and a system administrator with financial grants', async () => {
    await ctx
      .api(ctx.users.admin)
      .post(`/users/${ctx.users.admin.id}/access-requests`)
      .send({ role: 'DIRECTOR' })
      .expect(403);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.director.id}/access-requests`)
      .send({ role: 'ADMIN' })
      .expect(403);
    await ctx
      .api(ctx.users.admin)
      .post(`/users/${ctx.users.staff2.id}/access-requests`)
      .send({ role: 'MANAGER' })
      .expect(201);
    await ctx
      .api(ctx.users.admin)
      .post(`/users/${ctx.users.staff2.id}/access-requests`)
      .send({ role: 'MANAGER' })
      .expect(409);
    const requests = await ctx
      .api(ctx.users.director)
      .get('/users/access-requests')
      .expect(200);
    const pending = (
      requests.body as { items: { id: string; status: string }[] }
    ).items.find((row) => row.status === 'PENDING');
    await ctx
      .api(ctx.users.director)
      .post(`/users/access-requests/${pending!.id}/review`)
      .send({ approve: false, reason: 'Chưa cần thay đổi' })
      .expect(201);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.staff2.id}/access-requests`)
      .send({ role: 'ADMIN', financialAccess: true })
      .expect(400);
  });
});

describe('Custom roles and teams', () => {
  let roleId: string;
  it('allows only the director to define a bounded business role', async () => {
    const dto = {
      name: 'Nhân viên chỉ đọc',
      baseRole: 'STAFF',
      scope: 'OWN',
      permissions: ['customers:view', 'tasks:view'],
    };
    await ctx
      .api(ctx.users.admin)
      .post('/users/access-roles')
      .send(dto)
      .expect(403);
    await ctx
      .api(ctx.users.director)
      .post('/users/access-roles')
      .send({ ...dto, scope: 'ALL' })
      .expect(400);
    await ctx
      .api(ctx.users.director)
      .post('/users/access-roles')
      .send({ ...dto, permissions: ['users:update'] })
      .expect(400);
    // 07 J1: quyền duyệt phiếu thu chỉ cấp được cho vai trò nền Quản lý (KTT).
    await ctx
      .api(ctx.users.director)
      .post('/users/access-roles')
      .send({ ...dto, permissions: ['payments:approve'] })
      .expect(400);
    await ctx
      .api(ctx.users.director)
      .post('/users/access-roles')
      .send({
        name: 'KTT duyệt thu',
        baseRole: 'MANAGER',
        scope: 'TEAM',
        permissions: ['payments:view', 'payments:approve', 'finance:view'],
      })
      .expect(201);
    const created = await ctx
      .api(ctx.users.director)
      .post('/users/access-roles')
      .send(dto)
      .expect(201);
    roleId = (created.body as { id: string }).id;
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.staff2.id}/access-requests`)
      .send({ role: 'STAFF', accessRoleId: roleId })
      .expect(201);
    await relogin(ctx, ctx.users.staff2);
    const me = await ctx.api(ctx.users.staff2).get('/auth/me').expect(200);
    expect((me.body as { permissions: string[] }).permissions.sort()).toEqual([
      'customers:view',
      'tasks:view',
    ]);
    await ctx.api(ctx.users.staff2).get('/dashboard').expect(403);
    await ctx
      .api(ctx.users.director)
      .delete(`/users/access-roles/${roleId}`)
      .expect(400);
  });
  it('revokes sessions when editing a role and allows deletion after unassignment', async () => {
    await ctx
      .api(ctx.users.director)
      .patch(`/users/access-roles/${roleId}`)
      .send({
        name: 'Nhân viên chỉ đọc',
        baseRole: 'STAFF',
        scope: 'OWN',
        permissions: ['customers:view'],
      })
      .expect(200);
    await ctx.api(ctx.users.staff2).get('/auth/me').expect(401);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.staff2.id}/access-requests`)
      .send({ role: 'STAFF', accessRoleId: null })
      .expect(201);
    await ctx
      .api(ctx.users.director)
      .delete(`/users/access-roles/${roleId}`)
      .expect(200);
    await relogin(ctx, ctx.users.staff2);
  });
});

describe('Team administration', () => {
  it('creates/renames teams and refuses to delete a populated team', async () => {
    const created = await ctx
      .api(ctx.users.admin)
      .post('/users/teams')
      .send({ name: 'Nhóm mới' })
      .expect(201);
    const id = (created.body as { id: string }).id;
    await ctx
      .api(ctx.users.admin)
      .patch(`/users/teams/${id}`)
      .send({ name: 'Nhóm đã đổi' })
      .expect(200);
    await ctx
      .api(ctx.users.admin)
      .delete(`/users/teams/${ctx.users.staff.teamId}`)
      .expect(400);
    await ctx.api(ctx.users.admin).delete(`/users/teams/${id}`).expect(200);
  });
});

describe('Safe account lifecycle administration', () => {
  it('prevents self-locking and removing the last privileged account', async () => {
    await ctx
      .api(ctx.users.admin)
      .patch(`/users/${ctx.users.admin.id}/lock`)
      .expect(400);
    await ctx
      .api(ctx.users.director)
      .patch(`/users/${ctx.users.admin.id}/lock`)
      .expect(400);
    await ctx
      .api(ctx.users.admin)
      .patch(`/users/${ctx.users.director.id}/lock`)
      .expect(403);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.director.id}/leave`)
      .expect(400);
  });
  it('allows profile edits, but queues role changes by admin and blocks password takeover', async () => {
    await ctx
      .api(ctx.users.admin)
      .patch(`/users/${ctx.users.staff2.id}`)
      .send({ fullName: 'Tên mới', title: null, phone: null, role: 'MANAGER' })
      .expect(200);
    const stored = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.users.staff2.id },
    });
    expect(stored.fullName).toBe('Tên mới');
    expect(stored.role).toBe('STAFF');
    await ctx
      .api(ctx.users.admin)
      .patch(`/users/${ctx.users.manager.id}`)
      .send({ password: 'NewStrong@123' })
      .expect(403);
    await ctx
      .api(ctx.users.manager)
      .patch(`/users/${ctx.users.staff.id}`)
      .send({ fullName: 'Không được sửa' })
      .expect(403);
  });
  it('creates invited accounts with pending elevated assignment, then logs departure without deleting data', async () => {
    const created = await ctx
      .api(ctx.users.admin)
      .post('/users')
      .send({
        email: ' elevated@test.vn ',
        fullName: 'Chờ cấp quyền',
        role: 'MANAGER',
      })
      .expect(201);
    const user = created.body as {
      id: string;
      role: string;
      mustChangePassword: boolean;
      accessRequests: unknown[];
    };
    expect(user).toMatchObject({ role: 'STAFF', mustChangePassword: true });
    expect(user.accessRequests).toHaveLength(1);
    await ctx.api(ctx.users.admin).post(`/users/${user.id}/leave`).expect(201);
    await ctx
      .api(ctx.users.admin)
      .patch(`/users/${user.id}/unlock`)
      .expect(400);
    const stored = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.leftAt).not.toBeNull();
    expect(stored.deletedAt).toBeNull();
    await ctx
      .api(ctx.users.admin)
      .post(`/users/${ctx.users.staff.id}/revoke-sessions`)
      .expect(201);
    await ctx.api(ctx.users.staff).get('/auth/me').expect(401);
    await login(ctx, ctx.users.staff.email, TEST_PASSWORD);
  });
});
