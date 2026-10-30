/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import {
  createTestContext,
  TestContext,
  TEST_PASSWORD,
} from './utils/test-app';

const SECRET = 'Cong-Thue@2026';
const NEW_SECRET = 'Doi-Moi#2027';
const day = (offset: number) =>
  new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * 09-B: thêm/sửa theo loại (L1, L2), đổi mật khẩu có lịch sử không lưu mật khẩu cũ (L5), xem/sao chép
 * có nhật ký (L6, L8), báo lỗi (L7), xoá có lý do (L10), revision 409; không lộ bí mật ở đâu khác.
 */
describe('09-B kho tài khoản (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let accountId: string;
  let revision: number;
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);

  beforeAll(async () => {
    ctx = await createTestContext();
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Kho Tài Khoản',
          taxCode: '0100009101',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    await as('manager')
      .post('/auth/verify-password')
      .send({ password: TEST_PASSWORD })
      .expect(201);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('bắt buộc theo loại; token chặn trùng serial (không phân biệt hoa thường, khoảng trắng); nhân viên 403', async () => {
    await as('manager')
      .post('/client-credentials')
      .send({ customerId, type: 'OTHER', username: 'u', password: 'p' })
      .expect(400);
    await as('manager')
      .post('/client-credentials')
      .send({ customerId, type: 'TAX_PORTAL', username: 'mst' })
      .expect(400);
    await as('manager')
      .post('/client-credentials')
      .send({
        customerId,
        type: 'DIGITAL_SIGNATURE',
        provider: 'VNPT_CA',
        expiresAt: day(90),
      })
      .expect(400);
    const token = await as('manager')
      .post('/client-credentials')
      .send({
        customerId,
        type: 'DIGITAL_SIGNATURE',
        provider: 'VNPT_CA',
        serialNumber: ' tk-09b-01 ',
        expiresAt: day(90),
        storageLocation: 'Tủ A2',
      })
      .expect(201);
    expect(token.body).toMatchObject({
      serialNumber: 'TK-09B-01',
      custody: 'OFFICE',
      username: null,
      hasSecret: false,
      daysToExpiry: 90,
    });
    await as('director')
      .post('/client-credentials')
      .send({
        customerId,
        type: 'DIGITAL_SIGNATURE',
        provider: 'VNPT_CA',
        serialNumber: 'TK-09B-01',
        expiresAt: day(90),
      })
      .expect(409);
    await as('staff')
      .post('/client-credentials')
      .send({ customerId, type: 'EMAIL', username: 'a@b.vn', password: 'x' })
      .expect(403);
    const created = await as('manager')
      .post('/client-credentials')
      .send({
        customerId,
        type: 'TAX_PORTAL',
        username: '0100009101',
        password: SECRET,
        url: 'https://thuedientu.gdt.gov.vn',
      })
      .expect(201);
    accountId = created.body.id;
    revision = created.body.revision;
    expect(created.body).toMatchObject({
      hasSecret: true,
      revision: 1,
      secretChangedBy: { id: ctx.users.manager.id },
    });
    expect(created.body.passwordEnc).toBeUndefined();
    expect(created.body.history.map((e: { type: string }) => e.type)).toEqual([
      'CREATED',
    ]);
  });

  it('sửa: revision cũ → 409; đổi mật khẩu + trạng thái + trường thường ghi 3 sự kiện, không lưu mật khẩu cũ', async () => {
    await as('manager')
      .patch(`/client-credentials/${accountId}`)
      .send({ revision: revision + 5, label: 'X' })
      .expect(409);
    const res = await as('manager')
      .patch(`/client-credentials/${accountId}`)
      .send({
        revision,
        label: 'Thuế điện tử',
        password: NEW_SECRET,
        status: 'NEED_CHANGE',
      })
      .expect(200);
    revision = res.body.revision;
    expect(revision).toBe(2);
    const types = res.body.history.map((e: { type: string }) => e.type).sort();
    expect(types).toEqual([
      'CREATED',
      'SECRET_CHANGED',
      'STATUS_CHANGED',
      'UPDATED',
    ]);
    const updated = res.body.history.find(
      (e: { type: string }) => e.type === 'UPDATED',
    );
    expect(updated.detail).toEqual({ fields: ['label'] });
    expect(updated.actor).toMatchObject({ id: ctx.users.manager.id });
    await as('manager')
      .patch(`/client-credentials/${accountId}`)
      .send({ revision: 1, note: 'cũ' })
      .expect(409);
    const unchanged = await as('manager')
      .patch(`/client-credentials/${accountId}`)
      .send({ revision, label: 'Thuế điện tử' })
      .expect(200);
    expect(unchanged.body.revision).toBe(revision); // không đổi gì → không tăng revision, không sự kiện
  });

  it('xem / sao chép: trả mật khẩu mới, mỗi lần một dòng nhật ký riêng + chung; nhật ký chỉ quản lý kho xem', async () => {
    const view = await as('manager')
      .post(`/client-credentials/${accountId}/secret`)
      .send({ purpose: 'VIEW' })
      .expect(200);
    expect(view.body).toEqual({ password: NEW_SECRET });
    await as('manager')
      .post(`/client-credentials/${accountId}/secret`)
      .send({ purpose: 'COPY' })
      .expect(200);
    await as('manager')
      .post(`/client-credentials/${accountId}/secret`)
      .send({ purpose: 'PRINT' })
      .expect(400);
    const log = await as('manager')
      .get(`/client-credentials/${accountId}/access-log`)
      .expect(200);
    expect(log.body.items.map((e: { type: string }) => e.type).sort()).toEqual([
      'SECRET_COPIED',
      'SECRET_VIEWED',
    ]);
    const audits = await ctx.prisma.auditLog.findMany({
      where: {
        entityId: accountId,
        action: { in: ['VIEW_SECRET', 'COPY_SECRET'] },
      },
    });
    expect(audits.map((a) => a.action).sort()).toEqual([
      'COPY_SECRET',
      'VIEW_SECRET',
    ]);
    await as('staff')
      .get(`/client-credentials/${accountId}/access-log`)
      .expect(403);
    const detail = await as('staff')
      .get(`/client-credentials/${accountId}`)
      .expect(200);
    expect(
      detail.body.history.map((e: { type: string }) => e.type),
    ).not.toContain('SECRET_VIEWED');
    expect(detail.body.revision).toBe(revision); // xem không làm đổi revision
  });

  it('báo lỗi (L7): nhân viên phụ trách được, ghi chú bắt buộc; ngoài phân công 404; thu tiền 403', async () => {
    await as('staff')
      .post(`/client-credentials/${accountId}/report-issue`)
      .send({ revision, status: 'ERROR', note: ' ' })
      .expect(400);
    await as('staff')
      .post(`/client-credentials/${accountId}/report-issue`)
      .send({ revision, status: 'ACTIVE', note: 'x' })
      .expect(400);
    await as('staff2')
      .post(`/client-credentials/${accountId}/report-issue`)
      .send({ revision, status: 'ERROR', note: 'x' })
      .expect(404);
    await as('cashier')
      .post(`/client-credentials/${accountId}/report-issue`)
      .send({ revision, status: 'ERROR', note: 'x' })
      .expect(403);
    const res = await as('staff')
      .post(`/client-credentials/${accountId}/report-issue`)
      .send({ revision, status: 'ERROR', note: 'Sai mật khẩu khi nộp tờ khai' })
      .expect(200);
    revision = res.body.revision;
    expect(res.body).toMatchObject({
      status: 'ERROR',
      statusNote: 'Sai mật khẩu khi nộp tờ khai',
    });
    await as('staff')
      .patch(`/client-credentials/${accountId}`)
      .send({ revision, status: 'ACTIVE' })
      .expect(403);
    const fixed = await as('manager')
      .patch(`/client-credentials/${accountId}`)
      .send({ revision, status: 'ACTIVE' })
      .expect(200);
    revision = fixed.body.revision;
    expect(fixed.body.statusNote).toBeNull();
  });

  it('lọc theo tab / trạng thái / sắp hết hạn; tìm theo serial', async () => {
    const tokens = await as('staff')
      .get('/client-credentials')
      .query({ kind: 'TOKEN', customerId })
      .expect(200);
    expect(tokens.body.items.map((i: { type: string }) => i.type)).toEqual([
      'DIGITAL_SIGNATURE',
    ]);
    const accounts = await as('staff')
      .get('/client-credentials')
      .query({ kind: 'ACCOUNT', customerId })
      .expect(200);
    expect(accounts.body.total).toBe(1);
    const expiring = await as('staff')
      .get('/client-credentials')
      .query({ expiring: 'true', customerId })
      .expect(200);
    expect(expiring.body.total).toBe(0); // token còn 90 ngày
    const search = await as('staff')
      .get('/client-credentials')
      .query({ search: 'tk-09b' })
      .expect(200);
    expect(search.body.total).toBe(1);
  });

  it('xoá: thiếu lý do 400, nhân viên 403, có lý do → ẩn khỏi danh sách, sự kiện có lý do; bí mật không xuất hiện ở đâu khác', async () => {
    await as('manager')
      .delete(`/client-credentials/${accountId}`)
      .send({ revision })
      .expect(400);
    await as('staff')
      .delete(`/client-credentials/${accountId}`)
      .send({ revision, reason: 'x' })
      .expect(403);
    await as('manager')
      .delete(`/client-credentials/${accountId}`)
      .send({ revision, reason: 'Khách đã đổi đơn vị dịch vụ' })
      .expect(200);
    await as('manager').get(`/client-credentials/${accountId}`).expect(404);
    const deleted = await ctx.prisma.credentialEvent.findFirstOrThrow({
      where: { credentialId: accountId, type: 'DELETED' },
    });
    expect(deleted.note).toBe('Khách đã đổi đơn vị dịch vụ');
    const dump = JSON.stringify([
      await ctx.prisma.credentialEvent.findMany(),
      await ctx.prisma.auditLog.findMany(),
      await ctx.prisma.notification.findMany(),
    ]);
    for (const secret of [SECRET, NEW_SECRET])
      expect(dump).not.toContain(secret);
  });
});
