import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import {
  createTestContext,
  TestContext,
  TEST_PASSWORD,
} from './utils/test-app';
import { asUser, login } from './utils/auth-flow';

let ctx: TestContext;
let number = 0;
const strong = 'NewStrong@123';
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.app.close();
});
async function fixtureUser() {
  return ctx.prisma.user.create({
    data: {
      email: `life${++number}@test.vn`,
      fullName: 'Lifecycle user',
      role: Role.STAFF,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
    },
  });
}
function publicApi() {
  return request(ctx.app.getHttpServer());
}
function tokenOf(link: string): string {
  return new URLSearchParams(new URL(link).hash.slice(1)).get('token')!;
}

describe('Expired and malformed refresh cookies', () => {
  it('rejects malformed UUIDs and expired sessions without server errors', async () => {
    for (const cookie of [
      'ketoan_refresh=',
      'ketoan_refresh=------------------------------------.invalid',
      'ketoan_refresh=not-a-session',
    ]) {
      await publicApi()
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    }
    const user = await fixtureUser();
    const session = await login(ctx, user.email, TEST_PASSWORD);
    await ctx.prisma.authSession.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await publicApi()
      .post('/api/v1/auth/refresh')
      .set('Cookie', session.cookie)
      .expect(401);
    await ctx.api(asUser(ctx, session.accessToken)).get('/auth/me').expect(401);
  });
});

describe('Refresh tokens and server-side revocation', () => {
  it('honours logout with the preceding cookie when refresh completes just before logout', async () => {
    const user = await fixtureUser();
    const first = await login(ctx, user.email, TEST_PASSWORD);
    const rotated = await publicApi()
      .post('/api/v1/auth/refresh')
      .set('Cookie', first.cookie)
      .expect(200);
    const nextCookie = (
      rotated.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
    await publicApi()
      .post('/api/v1/auth/logout')
      .set('Cookie', first.cookie)
      .expect(200);
    await ctx
      .api(asUser(ctx, (rotated.body as { accessToken: string }).accessToken))
      .get('/auth/me')
      .expect(401);
    await publicApi()
      .post('/api/v1/auth/refresh')
      .set('Cookie', nextCookie)
      .expect(401);
  });
  it('uses HttpOnly cookies and rotates refresh tokens; replay revokes the session', async () => {
    const user = await fixtureUser();
    const first = await login(ctx, user.email, TEST_PASSWORD);
    expect(first.cookieHeader).toContain('HttpOnly');
    expect(first.cookieHeader).toContain('SameSite=Strict');
    expect(first).not.toHaveProperty('refreshToken');
    const rotated = await publicApi()
      .post('/api/v1/auth/refresh')
      .set('Cookie', first.cookie)
      .expect(200);
    const body = rotated.body as { accessToken: string; refreshToken?: string };
    expect(body.refreshToken).toBeUndefined();
    expect(
      (rotated.headers['set-cookie'] as unknown as string[])[0],
    ).not.toContain(first.cookie);
    await ctx.api(asUser(ctx, body.accessToken)).get('/auth/me').expect(200);
    await publicApi()
      .post('/api/v1/auth/refresh')
      .set('Cookie', first.cookie)
      .expect(401);
    await ctx.api(asUser(ctx, body.accessToken)).get('/auth/me').expect(401);
    const stored = await ctx.prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(stored.refreshHash).not.toContain(first.cookie.split('=')[1]);
    expect(stored.revokedAt).not.toBeNull();
  });
});

describe('Logout and device isolation', () => {
  it('logs out on the server and rejects foreign Origin refresh requests', async () => {
    const user = await fixtureUser();
    const session = await login(ctx, user.email, TEST_PASSWORD);
    await publicApi()
      .post('/api/v1/auth/refresh')
      .set('Cookie', session.cookie)
      .set('Origin', 'https://attacker.example')
      .expect(403);
    await publicApi()
      .post('/api/v1/auth/logout')
      .set('Cookie', session.cookie)
      .expect(200);
    await ctx.api(asUser(ctx, session.accessToken)).get('/auth/me').expect(401);
    await publicApi()
      .post('/api/v1/auth/refresh')
      .set('Cookie', session.cookie)
      .expect(401);
    expect(
      await ctx.prisma.auditLog.count({
        where: { userId: user.id, action: 'LOGOUT' },
      }),
    ).toBe(1);
  });
  it('shows only own sessions and revokes one or all devices', async () => {
    const user = await fixtureUser();
    const first = await login(ctx, user.email, TEST_PASSWORD);
    const second = await login(ctx, user.email, TEST_PASSWORD);
    const me = asUser(ctx, first.accessToken);
    const result = await ctx.api(me).get('/auth/sessions').expect(200);
    const sessions = result.body as { id: string; current: boolean }[];
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((row) => row.current)).toHaveLength(1);
    expect(JSON.stringify(result.body)).not.toContain('refreshHash');
    await ctx
      .api(me)
      .delete(`/auth/sessions/${sessions.find((row) => !row.current)!.id}`)
      .expect(200);
    await ctx.api(asUser(ctx, second.accessToken)).get('/auth/me').expect(401);
    await ctx.api(me).delete('/auth/sessions').expect(200);
    await ctx.api(me).get('/auth/me').expect(401);
  });
});

describe('Invitation and password recovery', () => {
  it('activates a one-time invitation and never exposes its hash in user responses', async () => {
    const created = await ctx
      .api(ctx.users.admin)
      .post('/users')
      .send({ email: 'invite@test.vn', fullName: 'Được mời', role: 'STAFF' })
      .expect(201);
    const id = (created.body as { id: string }).id;
    const invitation = await ctx
      .api(ctx.users.admin)
      .post(`/users/${id}/invite`)
      .expect(201);
    const link = (invitation.body as { link: string; emailSent: boolean }).link;
    const token = tokenOf(link);
    expect(link).toContain('/activate#token=');
    expect(
      await ctx.prisma.userActionToken.count({ where: { tokenHash: token } }),
    ).toBe(0);
    await publicApi()
      .post('/api/v1/auth/activate')
      .send({ token, password: strong })
      .expect(200);
    await publicApi()
      .post('/api/v1/auth/activate')
      .send({ token, password: strong })
      .expect(400);
    const activated = await login(ctx, 'invite@test.vn', strong);
    expect(activated.user.mustChangePassword).toBe(false);
    const logs = await ctx.prisma.auditLog.findMany({
      where: { entityId: id },
    });
    expect(JSON.stringify(logs)).not.toContain(token);
    expect(JSON.stringify(logs)).not.toContain(strong);
  });
  it('refuses expired or wrong-purpose links and invalidates older issued links', async () => {
    const user = await fixtureUser();
    const first = await ctx
      .api(ctx.users.director)
      .post(`/users/${user.id}/password-reset`)
      .expect(201);
    const firstToken = tokenOf((first.body as { link: string }).link);
    const next = await ctx
      .api(ctx.users.director)
      .post(`/users/${user.id}/password-reset`)
      .expect(201);
    const nextToken = tokenOf((next.body as { link: string }).link);
    await publicApi()
      .post('/api/v1/auth/reset-password')
      .send({ token: firstToken, password: strong })
      .expect(400);
    await publicApi()
      .post('/api/v1/auth/activate')
      .send({ token: nextToken, password: strong })
      .expect(400);
    await ctx.prisma.userActionToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await publicApi()
      .post('/api/v1/auth/reset-password')
      .send({ token: nextToken, password: strong })
      .expect(400);
  });
});

describe('Reset sessions and account privacy', () => {
  it('invalidates administrator-known links and initial passwords when privileges change', async () => {
    const created = await ctx
      .api(ctx.users.admin)
      .post('/users')
      .send({
        email: 'promote-invite@test.vn',
        fullName: 'Promoted invitation',
        role: 'STAFF',
        password: strong,
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    const invite = await ctx
      .api(ctx.users.admin)
      .post(`/users/${id}/invite`)
      .expect(201);
    const token = tokenOf((invite.body as { link: string }).link);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${id}/access-requests`)
      .send({ role: 'STAFF', financialAccess: true })
      .expect(201);
    await publicApi()
      .post('/api/v1/auth/activate')
      .send({ token, password: 'ChangedStrong@123' })
      .expect(400);
    await publicApi()
      .post('/api/v1/auth/login')
      .send({ email: 'promote-invite@test.vn', password: strong })
      .expect(401);
    await ctx.api(ctx.users.admin).post(`/users/${id}/invite`).expect(503);
    const next = await ctx
      .api(ctx.users.director)
      .post(`/users/${id}/invite`)
      .expect(201);
    await publicApi()
      .post('/api/v1/auth/activate')
      .send({
        token: tokenOf((next.body as { link: string }).link),
        password: 'ChangedStrong@123',
      })
      .expect(200);
    expect(
      (await login(ctx, 'promote-invite@test.vn', 'ChangedStrong@123'))
        .permissions,
    ).toContain('finance:view');
  });
  it('resets a password once, revokes sessions and returns generic forgotten-password responses', async () => {
    const user = await fixtureUser();
    const session = await login(ctx, user.email, TEST_PASSWORD);
    const issue = await ctx
      .api(ctx.users.director)
      .post(`/users/${user.id}/password-reset`)
      .expect(201);
    const token = tokenOf((issue.body as { link: string }).link);
    await publicApi()
      .post('/api/v1/auth/reset-password')
      .send({ token, password: strong })
      .expect(200);
    await ctx.api(asUser(ctx, session.accessToken)).get('/auth/me').expect(401);
    await publicApi()
      .post('/api/v1/auth/reset-password')
      .send({ token, password: strong })
      .expect(400);
    await login(ctx, user.email, strong);
    const unknown = await publicApi()
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'missing@test.vn' })
      .expect(200);
    const known = await publicApi()
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);
    expect(known.body).toEqual(unknown.body);
    expect(JSON.stringify(known.body)).not.toContain('link');
  });
});

describe('Password policy, first login and temporary locks', () => {
  it('enforces a strong password and requires changing an initial password', async () => {
    await ctx
      .api(ctx.users.admin)
      .post('/users')
      .send({
        email: 'weak@test.vn',
        fullName: 'Weak',
        role: 'STAFF',
        password: 'weakpassword',
      })
      .expect(400);
    const created = await ctx
      .api(ctx.users.admin)
      .post('/users')
      .send({
        email: 'initial@test.vn',
        fullName: 'Initial',
        role: 'STAFF',
        password: strong,
      })
      .expect(201);
    const initial = await login(ctx, 'initial@test.vn', strong);
    const me = asUser(ctx, initial.accessToken);
    expect(initial.user.id).toBe((created.body as { id: string }).id);
    expect(initial.user.mustChangePassword).toBe(true);
    const forbidden = await ctx.api(me).get('/customers').expect(401);
    expect((forbidden.body as { code: string }).code).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );
    await ctx
      .api(me)
      .post('/auth/change-password')
      .send({ currentPassword: strong, password: 'AnotherStrong@123' })
      .expect(201);
    await ctx.api(me).get('/auth/me').expect(401);
    expect(
      (await login(ctx, 'initial@test.vn', 'AnotherStrong@123')).user
        .mustChangePassword,
    ).toBe(false);
  });
  it('locks after five failures, rejects correct passwords during the lock and allows login after expiry', async () => {
    const user = await fixtureUser();
    for (let i = 0; i < 5; i++)
      await publicApi()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Wrong@123' })
        .expect(401);
    const locked = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(locked.failedLoginCount).toBe(5);
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    await publicApi()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(401);
    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1) },
    });
    await login(ctx, user.email, TEST_PASSWORD);
    expect(
      (await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
        .failedLoginCount,
    ).toBe(0);
  });
});

describe('Authenticated password checks', () => {
  it('does not allow password reuse or incorrect current passwords', async () => {
    const user = await fixtureUser();
    const session = await login(ctx, user.email, TEST_PASSWORD);
    const me = asUser(ctx, session.accessToken);
    await ctx
      .api(me)
      .post('/auth/change-password')
      .send({ currentPassword: 'Wrong@123', password: strong })
      .expect(400);
    await ctx
      .api(me)
      .post('/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, password: 'weak' })
      .expect(400);
    await ctx
      .api(me)
      .post('/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, password: strong })
      .expect(201);
    const next = await login(ctx, user.email, strong);
    await ctx
      .api(asUser(ctx, next.accessToken))
      .post('/auth/change-password')
      .send({ currentPassword: strong, password: strong })
      .expect(400);
  });
  it('persists failed secret verification and rejects unauthorised self-profile fields', async () => {
    const user = await fixtureUser();
    const session = await login(ctx, user.email, TEST_PASSWORD);
    const me = asUser(ctx, session.accessToken);
    await ctx
      .api(me)
      .post('/auth/verify-password')
      .send({ password: 'Wrong@123' })
      .expect(401);
    expect(
      (await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
        .failedLoginCount,
    ).toBe(1);
    await ctx
      .api(me)
      .post('/auth/verify-password')
      .send({ password: TEST_PASSWORD })
      .expect(201);
    await ctx
      .api(me)
      .patch('/auth/profile')
      .send({ fullName: 'New name', financialAccess: true })
      .expect(400);
  });
});
