/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import {
  createTestContext,
  TestContext,
  TEST_PASSWORD,
} from './utils/test-app';

const PIN = 'Pin-778899';
const day = (offset: number) =>
  new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * 09-B token chữ ký số (L2–L4, L10): mượn cho mình, mượn đồng thời [200, 409], trả bởi người mượn /
 * quản lý, giao cho nhân viên khác, thu hồi, trả khách, nhận từ khách; lọc mượn quá hạn; PIN không lộ.
 */
describe('09-B token chữ ký số (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let tokenId: string;
  let revision: number;
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const act = (who: keyof TestContext['users'], path: string, body: object) =>
    as(who)
      .post(`/client-credentials/${tokenId}/${path}`)
      .send({ revision, ...body });
  type Detail = Record<string, unknown> & {
    revision: number;
    history: { type: string }[];
  };
  const keep = (res: { body: Detail }) => {
    revision = res.body.revision;
    return res.body;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Token',
          taxCode: '0100009102',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    // staff2 (nhóm khác) được phân công KH này → được nhận token khi giao.
    await ctx.prisma.customerAssignment.create({
      data: {
        customerId,
        userId: ctx.users.staff2.id,
        assignedById: ctx.users.director.id,
      },
    });
    const created = await as('manager')
      .post('/client-credentials')
      .send({
        customerId,
        type: 'DIGITAL_SIGNATURE',
        provider: 'VIETTEL_CA',
        serialNumber: 'VT-09B-77',
        expiresAt: day(20),
        password: PIN,
        storageLocation: 'Két sắt',
      })
      .expect(201);
    tokenId = created.body.id;
    keep(created);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('hạn trả sai → 400; hai người mượn cùng lúc → một 200, một 409; mượn khi đang mượn → 400', async () => {
    await act('staff', 'borrow', { dueDate: day(-1) }).expect(400);
    await act('staff', 'borrow', { dueDate: day(31) }).expect(400);
    const [a, b] = await Promise.all([
      act('staff', 'borrow', { dueDate: day(1), purpose: 'Nộp tờ khai GTGT' }),
      act('manager', 'borrow', { dueDate: day(2) }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? a : b;
    const body = keep(winner);
    expect(body.custody).toBe('LOANED');
    expect(body.loanOverdue).toBe(false);
    await act('director', 'borrow', { dueDate: day(1) }).expect(400);
    // Trả lại cho lượt tiếp theo dùng `staff` làm người mượn rõ ràng.
    keep(await act('manager', 'custody', { custody: 'OFFICE' }).expect(200));
    keep(
      await act('staff', 'borrow', {
        dueDate: day(1),
        purpose: 'Nộp tờ khai GTGT',
      }).expect(200),
    );
  });

  it('trả: người khác không có quyền quản lý → 403; người mượn trả → về văn phòng, giữ nơi cất', async () => {
    await act('staff2', 'return', {}).expect(403);
    const body = keep(
      await act('staff', 'return', { note: 'Đã nộp xong' }).expect(200),
    );
    expect(body).toMatchObject({
      custody: 'OFFICE',
      holder: null,
      loanDueAt: null,
      storageLocation: 'Két sắt',
    });
    await act('staff', 'return', {}).expect(400);
  });

  it('giao: nhân viên không giao được (403); người nhận không xem được KH → 400; quản lý giao cho staff2 được', async () => {
    await act('staff', 'hand-over', {
      holderId: ctx.users.staff2.id,
      dueDate: day(3),
    }).expect(403);
    await act('manager', 'hand-over', {
      holderId: ctx.users.cashier.id,
      dueDate: day(3),
    }).expect(400);
    const body = keep(
      await act('manager', 'hand-over', {
        holderId: ctx.users.staff2.id,
        dueDate: day(3),
        purpose: 'Ký BCTC',
      }).expect(200),
    );
    expect(body).toMatchObject({
      custody: 'LOANED',
      holder: { id: ctx.users.staff2.id },
    });
    await act('manager', 'hand-over', {
      holderId: ctx.users.staff2.id,
      dueDate: day(3),
    }).expect(400);
  });

  it('mượn quá hạn: lọc được và cờ loanOverdue', async () => {
    await ctx.prisma.clientCredential.update({
      where: { id: tokenId },
      data: { loanDueAt: new Date(`${day(-2)}T00:00:00.000Z`) },
    });
    const res = await as('manager')
      .get('/client-credentials')
      .query({ overdueLoan: 'true', customerId })
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      loanOverdue: true,
      holder: { id: ctx.users.staff2.id },
    });
    const expiring = await as('manager')
      .get('/client-credentials')
      .query({ expiring: 'true', customerId })
      .expect(200);
    expect(expiring.body.items[0].daysToExpiry).toBe(20);
  });

  it('không xoá được khi đang mượn; thu hồi → trả khách → không mượn được → nhận lại từ khách', async () => {
    await as('manager')
      .delete(`/client-credentials/${tokenId}`)
      .send({ revision, reason: 'Hết dùng' })
      .expect(400);
    await act('staff', 'custody', { custody: 'OFFICE' }).expect(403);
    keep(
      await act('manager', 'custody', {
        custody: 'OFFICE',
        note: 'Thu hồi',
      }).expect(200),
    );
    const atCustomer = keep(
      await act('manager', 'custody', {
        custody: 'CUSTOMER',
        note: 'Trả khách cuối năm',
      }).expect(200),
    );
    expect(atCustomer.storageLocation).toBeNull();
    await act('manager', 'custody', { custody: 'CUSTOMER' }).expect(400);
    await act('staff', 'borrow', { dueDate: day(1) }).expect(400);
    const back = keep(
      await act('manager', 'custody', {
        custody: 'OFFICE',
        storageLocation: 'Tủ B1',
      }).expect(200),
    );
    expect(back).toMatchObject({ custody: 'OFFICE', storageLocation: 'Tủ B1' });
    expect(back.history.map((e) => e.type).reverse()).toEqual([
      'CREATED',
      'BORROWED',
      'RETURNED',
      'BORROWED',
      'RETURNED',
      'HANDED_OVER',
      'RETURNED',
      'RETURNED_TO_CUSTOMER',
      'RECEIVED_FROM_CUSTOMER',
    ]);
  });

  it('tài khoản cổng không mượn được; PIN xem được nhưng không có trong lịch sử / nhật ký', async () => {
    const account = await as('manager')
      .post('/client-credentials')
      .send({
        customerId,
        type: 'EMAIL',
        username: 'ketoan@kh.vn',
        password: 'Mail@1',
      })
      .expect(201);
    await as('staff')
      .post(`/client-credentials/${account.body.id}/borrow`)
      .send({ revision: 1, dueDate: day(1) })
      .expect(400);
    await as('manager')
      .post('/auth/verify-password')
      .send({ password: TEST_PASSWORD })
      .expect(201);
    const pin = await as('manager')
      .post(`/client-credentials/${tokenId}/secret`)
      .send({ purpose: 'COPY' })
      .expect(200);
    expect(pin.body).toEqual({ password: PIN });
    const dump = JSON.stringify([
      await as('manager')
        .get(`/client-credentials/${tokenId}`)
        .expect(200)
        .then((r) => r.body),
      await as('manager')
        .get('/client-credentials')
        .expect(200)
        .then((r) => r.body),
      await ctx.prisma.credentialEvent.findMany(),
      await ctx.prisma.auditLog.findMany(),
    ]);
    expect(dump).not.toContain(PIN);
    expect(dump).not.toContain('Mail@1');
  });
});
