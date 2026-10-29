/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { ContractStatus } from '@prisma/client';
import { createTestContext, TestContext } from './utils/test-app';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

/**
 * 08-D (K8): đối chiếu thu – xuất theo HĐ. HĐ A: đã thu 3.300.000 (đã duyệt) + phiếu chờ duyệt không
 * tính; đã xuất 5.500.000 (gốc) − 1.100.000 (điều chỉnh) = 4.400.000; đề nghị chờ xuất 1.100.000;
 * hoá đơn bị thay thế không tính → đã xuất chưa thu 1.100.000. HĐ B: đã thu 2.200.000, chưa xuất →
 * đã thu chưa xuất 2.200.000. HĐ C: thu = xuất 1.100.000 → không lệch. HĐ nháp không có trong bảng.
 */
describe('08-D đối chiếu thu – xuất (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  const ids: Record<string, string> = {};
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);

  const contract = async (
    code: string,
    status: ContractStatus = ContractStatus.IN_PROGRESS,
  ) =>
    (
      await ctx.prisma.contract.create({
        data: {
          code,
          customerId,
          status,
          startDate: d('2026-01-01'),
          subtotal: '10000000',
          vatRate: 10,
          vatAmount: '1000000',
          total: '11000000',
        },
      })
    ).id;
  const payment = (
    contractId: string,
    code: string,
    amount: string,
    status = 'APPROVED',
  ) =>
    ctx.prisma.payment.create({
      data: {
        contractId,
        code,
        amount,
        paidDate: d('2026-05-01'),
        status: status as 'APPROVED',
        receivedById: ctx.users.cashier.id,
      },
    });
  const invoice = (
    contractId: string,
    status: string,
    subtotal: string,
    extra: Record<string, unknown> = {},
  ) =>
    ctx.prisma.invoice.create({
      data: {
        contractId,
        status: status as 'ISSUED',
        subtotal,
        vatAmount: String(Number(subtotal) / 10),
        total: String(Number(subtotal) * 1.1),
        issueDate: status === 'REQUESTED' ? null : d('2026-06-01'),
        requestedById: ctx.users.cashier.id,
        ...extra,
      },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Đối Chiếu',
          taxCode: '0100008101',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    ids.A = await contract('HD-2026-R08A');
    ids.B = await contract('HD-2026-R08B');
    ids.C = await contract('HD-2026-R08C');
    ids.D = await contract('HD-2026-R08D', ContractStatus.DRAFT);
    await payment(ids.A, 'PT-R08-1', '3300000');
    await payment(ids.A, 'PT-R08-2', '500000', 'PENDING');
    const original = await invoice(ids.A, 'ADJUSTED', '5000000');
    await invoice(ids.A, 'ISSUED', '-1000000', {
      kind: 'ADJUSTMENT',
      relatedId: original.id,
    });
    await invoice(ids.A, 'REPLACED', '9000000');
    await invoice(ids.A, 'REQUESTED', '1000000');
    await invoice(ids.A, 'CANCELLED', '2000000');
    await payment(ids.B, 'PT-R08-3', '2200000');
    await payment(ids.C, 'PT-R08-4', '1100000');
    await invoice(ids.C, 'ISSUED', '1000000');
    await payment(ids.D, 'PT-R08-5', '700000');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('theo HĐ: đã thu (đã duyệt), đã xuất (hiệu lực gồm VAT), chờ xuất, chênh lệch hai chiều; tổng cộng; HĐ nháp không có', async () => {
    const res = await as('cashier')
      .get('/invoices/reconciliation')
      .query({ customerId })
      .expect(200);
    const row = (id: string) =>
      res.body.items.find((r: { contractId: string }) => r.contractId === id);
    expect(res.body.items).toHaveLength(3);
    expect(row(ids.A)).toMatchObject({
      paid: '3300000',
      invoiced: '4400000',
      requested: '1100000',
      paidNotInvoiced: '0',
      invoicedNotPaid: '1100000',
    });
    expect(row(ids.B)).toMatchObject({
      paid: '2200000',
      invoiced: '0',
      paidNotInvoiced: '2200000',
      invoicedNotPaid: '0',
    });
    expect(row(ids.C)).toMatchObject({
      paidNotInvoiced: '0',
      invoicedNotPaid: '0',
    });
    expect(row(ids.D)).toBeUndefined();
    expect(res.body.summary).toMatchObject({
      paid: '6600000',
      invoiced: '5500000',
      requested: '1100000',
      paidNotInvoiced: '2200000',
      invoicedNotPaid: '1100000',
    });
  });

  it('chỉ HĐ chênh lệch; đối chiếu đến ngày (trước khi xuất hoá đơn → chưa có gì đã xuất)', async () => {
    const mismatch = await as('director')
      .get('/invoices/reconciliation')
      .query({ customerId, mismatchOnly: 'true' })
      .expect(200);
    expect(
      mismatch.body.items.map((r: { code: string }) => r.code).sort(),
    ).toEqual(['HD-2026-R08A', 'HD-2026-R08B']);
    const asOf = await as('director')
      .get('/invoices/reconciliation')
      .query({ customerId, to: '2026-05-15' })
      .expect(200);
    expect(asOf.body.summary).toMatchObject({
      paid: '6600000',
      invoiced: '0',
      paidNotInvoiced: '6600000',
    });
  });

  it('Excel sổ hoá đơn và đối chiếu: Kế toán thu tiền/GĐ được; KTT xem đối chiếu được nhưng không xuất Excel; nhân viên 403', async () => {
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
    for (const path of [
      '/invoices/export',
      '/invoices/reconciliation/export',
    ]) {
      const res = await download(path, 'cashier').expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
      await download(path, 'director').expect(200);
      await download(path, 'manager').expect(403);
      await download(path, 'staff').expect(403);
    }
    await as('manager').get('/invoices/reconciliation').expect(200);
    await as('staff').get('/invoices/reconciliation').expect(403);
  });
});
