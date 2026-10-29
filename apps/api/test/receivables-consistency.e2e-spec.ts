/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { ContractStatus } from '@prisma/client';
import { collectPayment } from './utils/payments';
import { createTestContext, TestContext } from './utils/test-app';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

/**
 * 07-B (R1, J4): một quy tắc công nợ cho thu tiền, HĐ, báo cáo. Đợt A quá hạn 1 triệu chưa thu, đợt B
 * chưa đến hạn đã thu chỉ định 1 triệu → quá hạn 1 triệu ở mọi nơi.
 */
describe('07-B công nợ thống nhất (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let contractId: string;
  const ids: Record<string, string> = {};
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);

  const overdueEverywhere = async () => {
    const report = await as('director').get('/reports/receivables').expect(200);
    const reportRow = report.body.rows.find(
      (r: { customerId: string }) => r.customerId === customerId,
    );
    const payments = await as('cashier')
      .get('/payments/receivables')
      .expect(200);
    const paymentRow = payments.body.items.find(
      (r: { contractId: string }) => r.contractId === contractId,
    );
    const detail = await as('director')
      .get(`/contracts/${contractId}`)
      .expect(200);
    const paidOf = (key: string) =>
      detail.body.installments.find((i: { id: string }) => i.id === ids[key])
        .paidAmount;
    return {
      report: reportRow.overdue,
      reportTotal: report.body.totals.overdue,
      payments: paymentRow.overdueAmount,
      paymentsTotal: payments.body.summary.overdueAmount,
      paidA: paidOf('A'),
      paidB: paidOf('B'),
    };
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Công Nợ R1',
          taxCode: '0100007071',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-2026-R1',
        customerId,
        status: ContractStatus.IN_PROGRESS,
        startDate: d('2026-01-01'),
        endDate: d('2027-12-31'),
        subtotal: '2000000',
        vatRate: 0,
        vatAmount: '0',
        total: '2000000',
        ownerId: ctx.users.manager.id,
        installments: {
          create: [
            {
              name: 'Đợt A',
              amount: '1000000',
              dueDate: d('2026-01-31'),
              sortOrder: 1,
            },
            {
              name: 'Đợt B',
              amount: '1000000',
              dueDate: d('2099-12-31'),
              sortOrder: 2,
            },
          ],
        },
      },
      include: { installments: true },
    });
    contractId = contract.id;
    for (const i of contract.installments) ids[i.name.slice(-1)] = i.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('R1: phiếu chỉ định đợt chưa đến hạn không che khoản quá hạn — báo cáo, thu tiền, HĐ cùng 1.000.000', async () => {
    // 07-C: thu qua lập → gửi → duyệt (chỉ phiếu Đã duyệt tính đã thu).
    await collectPayment(ctx, {
      contractId,
      installmentId: ids.B,
      amount: '1000000',
      paidDate: '2026-02-10',
    });
    expect(await overdueEverywhere()).toEqual({
      report: '1000000',
      reportTotal: '1000000',
      payments: '1000000',
      paymentsTotal: '1000000',
      paidA: '0',
      paidB: '1000000',
    });
  });

  it('phiếu không chỉ định trừ đợt hạn sớm nhất; huỷ phiếu thì phân bổ và quá hạn khôi phục ở mọi nơi', async () => {
    const id = await collectPayment(ctx, {
      contractId,
      amount: '400000',
      paidDate: '2026-03-01',
    });
    expect(await overdueEverywhere()).toMatchObject({
      report: '600000',
      payments: '600000',
      paidA: '400000',
      paidB: '1000000',
    });
    // 07-C (J5): không xoá — huỷ phiếu đã duyệt có lý do.
    await as('director')
      .post(`/payments/${id}/cancel`)
      .send({ revision: 3, reason: 'Nhập sai số tiền' })
      .expect(200);
    expect(await overdueEverywhere()).toMatchObject({
      report: '1000000',
      payments: '1000000',
      paidA: '0',
    });
  });
});
