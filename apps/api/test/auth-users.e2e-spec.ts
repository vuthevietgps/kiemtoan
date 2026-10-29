import request from 'supertest';
import { createTestContext, TestContext } from './utils/test-app';

describe('Auth & Users (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('đăng nhập sai mật khẩu bị từ chối', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'staff@test.vn', password: 'sai-mat-khau' })
      .expect(401);
  });

  it('chưa đăng nhập thì không gọi được API', async () => {
    await request(ctx.app.getHttpServer()).get('/api/v1/users').expect(401);
  });

  it('/auth/me trả về người dùng và danh sách quyền', async () => {
    const res = await ctx.api(ctx.users.staff).get('/auth/me').expect(200);
    const body = res.body as { user: { email: string }; permissions: string[] };
    expect(body.user.email).toBe('staff@test.vn');
    expect(body.permissions).toContain('tasks:update');
    expect(body.permissions).not.toContain('users:create');
  });

  it('quản trị tạo được người dùng, không trả về mật khẩu', async () => {
    const res = await ctx
      .api(ctx.users.admin)
      .post('/users')
      .send({
        email: 'Moi@Test.vn',
        password: 'DemoStrong@123',
        fullName: 'Người mới',
        role: 'STAFF',
      })
      .expect(201);
    const body = res.body as { email: string; passwordHash?: unknown };
    expect(body.email).toBe('moi@test.vn');
    expect(body.passwordHash).toBeUndefined();
  });

  it('nhân viên không được tạo người dùng (403)', async () => {
    await ctx
      .api(ctx.users.staff)
      .post('/users')
      .send({
        email: 'x@test.vn',
        password: 'Demo@123',
        fullName: 'X',
        role: 'STAFF',
      })
      .expect(403);
  });

  it('tài khoản bị khoá không đăng nhập được', async () => {
    await ctx
      .api(ctx.users.admin)
      .patch(`/users/${ctx.users.staff2.id}/lock`)
      .expect(200);
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'staff2@test.vn', password: 'Test@123' })
      .expect(401);
    await ctx.api(ctx.users.staff2).get('/auth/me').expect(401);
  });

  it('thao tác thay đổi dữ liệu được ghi nhật ký', async () => {
    const logs = await ctx.prisma.auditLog.findMany({
      where: { entity: 'users', action: 'CREATE' },
    });
    expect(logs.length).toBeGreaterThan(0);
  });
});
