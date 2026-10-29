/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { ContractStatus } from '@prisma/client';
import { addDays, todayVn } from '../src/modules/reports/utils/period.util';
import { collectPayment } from './utils/payments';
import { createTestContext, TestContext } from './utils/test-app';

const today = todayVn();
const dayKey = (offset: number) =>
  addDays(today, offset).toISOString().slice(0, 10);

/**
 * 07-D1 (J12): công nợ theo HĐ có đợt còn nợ và tuổi nợ theo từng đợt; danh sách đợt sắp đến hạn /
 * quá hạn; xuất Excel công nợ và phiếu thu theo `payments:export`.
 * HĐ 6 tr: đợt A quá hạn 45 ngày 1 tr (đã thu 400 nghìn), B còn 3 ngày 2 tr, C còn 20 ngày 3 tr;
 * thêm một phiếu Chờ duyệt 100 nghìn.
 */
describe('07-D1 công nợ, tuổi nợ (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let contractId: string;
  const ids: Record<string, string> = {};
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);

  beforeAll(async () => {
    ctx = await createTestContext();
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Tuổi Nợ',
          taxCode: '0100007401',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-2026-T07D',
        customerId,
        ownerId: ctx.users.manager.id,
        status: ContractStatus.IN_PROGRESS,
        startDate: addDays(today, -90),
        subtotal: '6000000',
        vatRate: 0,
        vatAmount: '0',
        total: '6000000',
        installments: {
          create: [
            {
              name: 'Đợt A',
              amount: '1000000',
              dueDate: addDays(today, -45),
              sortOrder: 1,
            },
            {
              name: 'Đợt B',
              amount: '2000000',
              dueDate: addDays(today, 3),
              sortOrder: 2,
            },
            {
              name: 'Đợt C',
              amount: '3000000',
              dueDate: addDays(today, 20),
              sortOrder: 3,
            },
          ],
        },
      },
      include: { installments: true },
    });
    contractId = contract.id;
    for (const i of contract.installments) ids[i.name.slice(-1)] = i.id;
    await collectPayment(ctx, {
      contractId,
      installmentId: ids.A,
      amount: '400000',
      paidDate: dayKey(0),
    });
    const pending = await as('cashier')
      .post('/payments')
      .send({
        contractId,
        amount: '100000',
        paidDate: dayKey(0),
        method: 'CASH',
        documentNumber: 'PT-GIAY-D1',
      })
      .expect(201);
    await as('cashier')
      .post(`/payments/${pending.body.id}/submit`)
      .send({ revision: 1 })
      .expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('công nợ HĐ: tuổi nợ chia theo đợt, sắp đến hạn 7 ngày, chờ duyệt, đợt còn nợ', async () => {
    const res = await as('cashier')
      .get('/payments/receivables')
      .query({ customerId })
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    const item = res.body.items[0];
    expect(item).toMatchObject({
      code: 'HD-2026-T07D',
      owner: { id: ctx.users.manager.id },
      paid: '400000',
      remaining: '5600000',
      overdueAmount: '600000',
      overdueDays: 45,
      pendingAmount: '100000',
      upcomingAmount: '2000000',
      aging: {
        notDue: '5000000',
        '0-30': '0',
        '31-60': '600000',
        '61-90': '0',
        '>90': '0',
      },
    });
    expect(
      item.installments.map((i: { name: string; remaining: string }) => [
        i.name,
        i.remaining,
      ]),
    ).toEqual([
      ['Đợt A', '600000'],
      ['Đợt B', '2000000'],
      ['Đợt C', '3000000'],
    ]);
    expect(item.installments[0]).toMatchObject({
      overdueDays: 45,
      bucket: '31-60',
    });
    expect(res.body.summary).toMatchObject({
      remaining: '5600000',
      upcomingAmount: '2000000',
      aging: { notDue: '5000000', '31-60': '600000' },
    });
  });

  it('đợt quá hạn / sắp đến hạn (7 ngày mặc định, tuỳ chọn số ngày); bộ lọc sai → 400', async () => {
    const list = async (query: Record<string, unknown>) =>
      (
        await as('director')
          .get('/payments/receivables/installments')
          .query({ customerId, ...query })
          .expect(200)
      ).body;
    const overdue = await list({ due: 'overdue' });
    expect(overdue).toMatchObject({
      total: '600000',
      items: [
        {
          id: ids.A,
          remaining: '600000',
          overdueDays: 45,
          contract: { id: contractId, code: 'HD-2026-T07D' },
          customer: { id: customerId },
          pendingAmount: '100000',
        },
      ],
    });
    const upcoming = await list({ due: 'upcoming' });
    expect(upcoming.items.map((i: { id: string }) => i.id)).toEqual([ids.B]);
    expect(upcoming.items[0].dueInDays).toBe(3);
    const month = await list({ due: 'upcoming', days: 30 });
    expect(month.items.map((i: { id: string }) => i.id)).toEqual([
      ids.B,
      ids.C,
    ]);
    await as('director')
      .get('/payments/receivables/installments')
      .query({ due: 'later' })
      .expect(400);
  });

  it('xuất Excel công nợ và phiếu thu: Kế toán thu tiền/GĐ được; KTT, nhân viên 403', async () => {
    const download = (path: string, who: keyof TestContext['users']) =>
      as(who)
        .get(path)
        .query({ customerId })
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });
    for (const path of ['/payments/receivables/export', '/payments/export']) {
      const res = await download(path, 'cashier').expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
      await download(path, 'director').expect(200);
      await download(path, 'manager').expect(403);
      await download(path, 'staff').expect(403);
    }
  });

  it('nhân viên không có quyền xem công nợ và danh sách đợt (403)', async () => {
    await as('staff').get('/payments/receivables').expect(403);
    await as('staff')
      .get('/payments/receivables/installments')
      .query({ due: 'overdue' })
      .expect(403);
  });
});
