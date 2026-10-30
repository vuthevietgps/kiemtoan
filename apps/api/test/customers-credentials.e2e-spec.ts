import {
  createTestContext,
  TestContext,
  TEST_PASSWORD,
} from './utils/test-app';
import { relogin } from './utils/auth-flow';

interface ListBody<T> {
  items: T[];
  total: number;
}

describe('Client credentials (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let credentialId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    for (const user of [ctx.users.staff, ctx.users.staff2]) {
      await ctx
        .api(ctx.users.director)
        .post(`/users/${user.id}/access-requests`)
        .send({ role: 'STAFF', secretAccess: true })
        .expect(201);
      await relogin(ctx, user);
    }
    for (const user of [ctx.users.staff, ctx.users.staff2, ctx.users.manager]) {
      await ctx
        .api(user)
        .post('/auth/verify-password')
        .send({ password: TEST_PASSWORD })
        .expect(201);
    }
    const customer = await ctx.prisma.customer.create({
      data: {
        name: 'Công ty CP ABC',
        taxCode: '0101234567',
        ownerId: ctx.users.staff.id,
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('Tài khoản công ty khách hàng', () => {
    it('tạo tài khoản, không trả mật khẩu', async () => {
      const res = await ctx
        .api(ctx.users.manager)
        .post('/client-credentials')
        .send({
          customerId,
          type: 'DIGITAL_SIGNATURE',
          provider: 'VNPT_CA',
          serialNumber: '0101234567',
          password: 'Token@2025',
          expiresAt: '2025-12-31',
        })
        .expect(201);
      const body = res.body as Record<string, unknown>;
      credentialId = body.id as string;
      expect(body.passwordEnc).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('Token@2025');
      const stored = await ctx.prisma.clientCredential.findUniqueOrThrow({
        where: { id: credentialId },
      });
      expect(stored.passwordEnc).not.toContain('Token@2025');
    });

    it('danh sách kèm tên khách hàng, không có passwordEnc', async () => {
      const res = await ctx
        .api(ctx.users.staff)
        .get('/client-credentials')
        .expect(200);
      const body = res.body as ListBody<Record<string, unknown>>;
      expect(body.total).toBe(1);
      expect(body.items[0].passwordEnc).toBeUndefined();
      expect((body.items[0].customer as { name: string }).name).toBe(
        'Công ty CP ABC',
      );
    });

    it('xem mật khẩu: trả bản rõ và ghi nhật ký VIEW_SECRET', async () => {
      const res = await ctx
        .api(ctx.users.staff)
        .post(`/client-credentials/${credentialId}/reveal`)
        .expect(200);
      expect(res.body).toEqual({ password: 'Token@2025' });
      const logs = await ctx.prisma.auditLog.findMany({
        where: { action: 'VIEW_SECRET', entityId: credentialId },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe(ctx.users.staff.id);
    });

    it('đổi mật khẩu khi sửa', async () => {
      await ctx
        .api(ctx.users.manager)
        .patch(`/client-credentials/${credentialId}`)
        .send({ revision: 1, password: 'Moi@2026', status: 'NEED_CHANGE' })
        .expect(200);
      const res = await ctx
        .api(ctx.users.manager)
        .post(`/client-credentials/${credentialId}/reveal`)
        .expect(200);
      expect(res.body).toEqual({ password: 'Moi@2026' });
    });

    it('thu ngân không xem được mật khẩu (403), nhân viên khác 404', async () => {
      await ctx
        .api(ctx.users.cashier)
        .post(`/client-credentials/${credentialId}/reveal`)
        .expect(403);
      await ctx
        .api(ctx.users.staff2)
        .post(`/client-credentials/${credentialId}/reveal`)
        .expect(404);
    });
  });
});
