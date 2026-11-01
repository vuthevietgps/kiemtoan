/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { ContractStatus } from '@prisma/client';
import { todayVn } from '../src/modules/reports/utils/period.util';
import { createTestContext, TestContext } from './utils/test-app';

/**
 * 10-D báo cáo Doanh thu (M4–M5): 3 thước đo không trộn — giá trị HĐ theo ngày duyệt, đã xuất hoá đơn
 * (hiệu lực, gồm điều chỉnh âm, bỏ bị thay thế / chờ xuất), đã thu (chỉ phiếu Đã duyệt); so cùng kỳ năm
 * trước; theo loại dịch vụ thì hoá đơn / phiếu thu là null; danh sách chi tiết = con số; phạm vi; quyền.
 */
describe('10-D báo cáo doanh thu (e2e)', () => {
  let ctx: TestContext;
  const ids: Record<string, string> = {};
  const today = todayVn();
  const year = today.getUTCFullYear();
  const lastYear = new Date(
    Date.UTC(year - 1, today.getUTCMonth(), Math.min(today.getUTCDate(), 28)),
  );
  const at = (day: Date) => new Date(day.getTime() + 3 * 3_600_000);
  const query = { from: `${year}-01-01`, to: `${year}-12-31` };
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const revenue = async (who: keyof TestContext['users'], groupBy: string) =>
    (
      await as(who)
        .get('/reports/revenue')
        .query({ ...query, groupBy })
        .expect(200)
    ).body;

  beforeAll(async () => {
    ctx = await createTestContext();
    const { prisma, users } = ctx;
    const a = await prisma.customer.create({
      data: {
        name: 'Công ty Doanh Thu A',
        taxCode: 'REV-A',
        ownerId: users.staff.id,
      },
    });
    const b = await prisma.customer.create({
      data: {
        name: 'Công ty Doanh Thu B',
        taxCode: 'REV-B',
        ownerId: users.staff2.id,
      },
    });
    const [s1, s2] = await Promise.all([
      prisma.serviceType.create({
        data: { code: 'REV-KTT', name: 'Kế toán thuế' },
      }),
      prisma.serviceType.create({
        data: { code: 'REV-BCTC', name: 'Báo cáo tài chính' },
      }),
    ]);
    const contract = (
      code: string,
      customerId: string,
      ownerId: string,
      approved: Date,
      lines: [string, number][],
    ) => {
      const subtotal = lines.reduce((n, [, v]) => n + v, 0);
      return prisma.contract.create({
        data: {
          code,
          customerId,
          ownerId,
          status: ContractStatus.IN_PROGRESS,
          approvedAt: at(approved),
          startDate: approved,
          subtotal,
          vatRate: 10,
          vatAmount: subtotal / 10,
          total: subtotal * 1.1,
          services: {
            create: lines.map(([serviceTypeId, amount]) => ({
              serviceTypeId,
              amount,
              unitPrice: amount,
            })),
          },
        },
      });
    };
    const c1 = await contract('REV-C1', a.id, users.staff.id, today, [
      [s1.id, 600_000],
      [s2.id, 400_000],
    ]);
    const c2 = await contract('REV-C2', b.id, users.staff2.id, today, [
      [s1.id, 2_000_000],
    ]);
    const c0 = await contract('REV-C0', a.id, users.staff.id, lastYear, [
      [s1.id, 800_000],
    ]);
    ids.c1 = c1.id;
    const invoice = (
      contractId: string,
      status: string,
      subtotal: number,
      issued: Date | null,
      kind = 'ORIGINAL',
    ) =>
      prisma.invoice.create({
        data: {
          contractId,
          status: status as 'ISSUED',
          kind: kind as 'ORIGINAL',
          subtotal,
          vatAmount: subtotal / 10,
          total: subtotal * 1.1,
          issueDate: issued,
          requestedById: users.cashier.id,
        },
      });
    await invoice(c1.id, 'ISSUED', 400_000, today);
    await invoice(c1.id, 'ISSUED', -50_000, today, 'ADJUSTMENT');
    await invoice(c1.id, 'REPLACED', 999_000, today);
    await invoice(c1.id, 'REQUESTED', 123_000, null);
    await invoice(c0.id, 'ISSUED', 500_000, lastYear);
    const payment = (
      contractId: string,
      code: string,
      amount: number,
      paidDate: Date,
      status = 'APPROVED',
    ) =>
      prisma.payment.create({
        data: {
          contractId,
          code,
          amount,
          paidDate,
          status: status as 'APPROVED',
          receivedById: users.cashier.id,
        },
      });
    await payment(c1.id, 'REV-PT1', 330_000, today);
    await payment(c1.id, 'REV-PT2', 100_000, today, 'PENDING');
    await payment(c2.id, 'REV-PT3', 1_100_000, today);
    await payment(c0.id, 'REV-PT0', 880_000, lastYear);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('theo khách hàng: 3 thước đo, so cùng kỳ năm trước; kỳ trước 0 → null', async () => {
    const body = await revenue('director', 'customer');
    const row = (name: string) =>
      body.rows.find((r: { name: string }) => r.name === name);
    expect(row('Công ty Doanh Thu A')).toMatchObject({
      contracts: 1,
      contractValue: '1000000',
      invoiced: '350000',
      paid: '330000',
      previous: { contractValue: '800000', invoiced: '500000', paid: '880000' },
      change: { contractValue: 25, invoiced: -30, paid: -62.5 },
    });
    expect(row('Công ty Doanh Thu B')).toMatchObject({
      contractValue: '2000000',
      invoiced: '0',
      paid: '1100000',
      change: { contractValue: null, invoiced: null, paid: null },
    });
    expect(body.totals).toMatchObject({
      contracts: 2,
      contractValue: '3000000',
      invoiced: '350000',
      paid: '1430000',
    });
    const sum = (list: { amount: string }[]) =>
      list.reduce((n, i) => n + Number(i.amount), 0);
    expect([
      body.details.contracts.length,
      sum(body.details.invoices),
      sum(body.details.payments),
    ]).toEqual([2, 350_000, 1_430_000]);
  });

  it('theo loại dịch vụ: giá trị theo dòng dịch vụ, hoá đơn / phiếu thu null; theo tháng ghép đúng tháng năm trước', async () => {
    const byService = await revenue('director', 'serviceType');
    expect(
      byService.rows.map(
        (r: {
          name: string;
          contractValue: string;
          invoiced: null;
          previous: { contractValue: string };
        }) => [r.name, r.contractValue, r.invoiced, r.previous.contractValue],
      ),
    ).toEqual([
      ['Kế toán thuế', '2600000', null, '800000'],
      ['Báo cáo tài chính', '400000', null, '0'],
    ]);
    expect(byService.totals).toMatchObject({
      contractValue: '3000000',
      invoiced: '350000',
    });
    const byMonth = await revenue('director', 'month');
    const month = `${year}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(
      byMonth.rows.find((r: { key: string }) => r.key === month),
    ).toMatchObject({
      contractValue: '3000000',
      previous: { contractValue: '800000' },
    });
  });

  it('khớp 08: đã thu của HĐ = cột đã thu ở đối chiếu thu – xuất; phạm vi KTT chỉ nhóm mình', async () => {
    const recon = await as('director')
      .get('/invoices/reconciliation')
      .expect(200);
    const c1 = recon.body.items.find(
      (r: { contractId: string }) => r.contractId === ids.c1,
    );
    const body = await revenue('director', 'customer');
    const a = body.rows.find(
      (r: { name: string }) => r.name === 'Công ty Doanh Thu A',
    );
    expect(Number(c1.paid)).toBe(Number(a.paid));
    const manager = await revenue('manager', 'customer');
    expect(manager.totals).toMatchObject({
      contracts: 1,
      contractValue: '1000000',
    });
  });

  it('quyền: nhân viên 403; KTT xuất Excel / CSV; thu tiền xem được, quản trị 403', async () => {
    await as('staff').get('/reports/revenue').expect(403);
    await as('admin').get('/reports/revenue').expect(403);
    await as('cashier').get('/reports/revenue').query(query).expect(200);
    const file = await as('manager')
      .get('/reports/revenue/export')
      .query({ ...query, groupBy: 'customer' })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect((file.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    const csv = await as('manager')
      .get('/reports/revenue')
      .query({ ...query, groupBy: 'customer', format: 'csv' })
      .expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('Công ty Doanh Thu A');
  });
});
