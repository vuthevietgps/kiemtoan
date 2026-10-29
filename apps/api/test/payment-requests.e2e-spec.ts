/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { ContractStatus } from '@prisma/client';
import JSZip from 'jszip';
import { reallocateContract } from '../src/modules/payments/payment-allocation';
import { createTestContext, TestContext } from './utils/test-app';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const BANK_ENV = {
  COMPANY_NAME: 'Công ty Kế toán Thử',
  COMPANY_BANK_BIN: '970407',
  COMPANY_BANK_ACCOUNT: '19036789012',
  COMPANY_BANK_NAME: 'Techcombank',
};
const previousEnv = Object.fromEntries(
  Object.keys(BANK_ENV).map((k) => [k, process.env[k]]),
);

/**
 * 07-D3 (J9): đề nghị thanh toán DOCX + VietQR — Kế toán thu tiền xem trước và tạo cho các đợt còn nợ;
 * file lưu kho hồ sơ gắn HĐ; chưa có mẫu thì dùng mẫu ví dụ; quyền theo `payments:create`.
 */
describe('07-D3 đề nghị thanh toán (e2e)', () => {
  let ctx: TestContext;
  let contractId: string;
  let draftId: string;
  const ids: Record<string, string> = {};
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const body = (installmentIds: string[], id = contractId) => ({
    contractId: id,
    installmentIds,
  });

  beforeAll(async () => {
    // Ngân hàng nhận của công ty (Techcombank) — đọc từ biến môi trường như cấu hình thật.
    Object.assign(process.env, BANK_ENV);
    ctx = await createTestContext();
    const customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Đề Nghị',
          taxCode: '0100007601',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    const base = {
      customerId,
      startDate: d('2026-01-01'),
      subtotal: '3000000',
      vatRate: 0,
      vatAmount: '0',
      total: '3000000',
    };
    const contract = await ctx.prisma.contract.create({
      data: {
        ...base,
        code: 'HD-2026-T07E',
        status: ContractStatus.IN_PROGRESS,
        installments: {
          create: [
            {
              name: 'Tạm ứng',
              amount: '1000000',
              dueDate: d('2026-02-01'),
              sortOrder: 1,
            },
            {
              name: 'Đợt 2',
              amount: '1000000',
              dueDate: d('2026-04-01'),
              sortOrder: 2,
            },
            {
              name: 'Đợt 3',
              amount: '1000000',
              dueDate: d('2026-06-01'),
              sortOrder: 3,
            },
          ],
        },
        payments: {
          create: {
            code: 'PT-T-07E',
            amount: '1000000',
            paidDate: d('2026-02-01'),
            status: 'APPROVED',
            receivedById: ctx.users.cashier.id,
          },
        },
      },
      include: { installments: true },
    });
    contractId = contract.id;
    for (const i of contract.installments) ids[i.name] = i.id;
    await ctx.prisma.$transaction((tx) => reallocateContract(tx, contractId));
    draftId = (
      await ctx.prisma.contract.create({
        data: {
          ...base,
          code: 'HD-2026-T07F',
          status: ContractStatus.DRAFT,
          installments: {
            create: {
              name: 'Đợt 1',
              amount: '3000000',
              dueDate: d('2026-02-01'),
            },
          },
        },
        include: { installments: true },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.app.close();
    // Trả lại cấu hình để các bộ test chạy sau trong cùng tiến trình không bị ảnh hưởng.
    for (const [key, value] of Object.entries(previousEnv))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  });

  it('xem trước: tổng còn thiếu các đợt chọn, nội dung CK có mã HĐ, ảnh VietQR', async () => {
    const res = await as('cashier')
      .post('/payments/payment-requests/preview')
      .send(body([ids['Đợt 2'], ids['Đợt 3']]))
      .expect(200);
    expect(res.body).toMatchObject({
      amount: '2000000',
      transferContent: 'TT HD-2026-T07E',
      contract: { id: contractId, code: 'HD-2026-T07E' },
      bank: { bin: '970407', accountNumber: '19036789012' },
    });
    expect(res.body.amountInWords).toMatch(/^Hai triệu đồng/);
    expect(res.body.qrPayload).toContain('54072000000');
    expect(res.body.qrImage).toMatch(/^data:image\/png;base64,/);
  });

  it('đợt đã thu đủ, đợt của HĐ khác, HĐ chưa duyệt → 400', async () => {
    await as('cashier')
      .post('/payments/payment-requests/preview')
      .send(body([ids['Tạm ứng']]))
      .expect(400);
    const draftInstallment =
      await ctx.prisma.paymentInstallment.findFirstOrThrow({
        where: { contractId: draftId },
      });
    await as('cashier')
      .post('/payments/payment-requests/preview')
      .send(body([draftInstallment.id]))
      .expect(400);
    await as('cashier')
      .post('/payments/payment-requests')
      .send(body([draftInstallment.id], draftId))
      .expect(400);
  });

  it('tạo DOCX từ mẫu ví dụ (chưa có mẫu công ty): lưu kho hồ sơ gắn HĐ, có số tiền và ảnh QR', async () => {
    const res = await as('cashier')
      .post('/payments/payment-requests')
      .send(body([ids['Đợt 2']]))
      .expect(201);
    expect(res.body).toMatchObject({
      type: 'PAYMENT_REQUEST',
      source: 'GENERATED',
      template: null,
      document: { fileName: 'Đề nghị thanh toán HD-2026-T07E.docx' },
    });
    const list = await as('director')
      .get(`/contracts/${contractId}/documents`)
      .expect(200);
    expect(list.body.map((x: { type: string }) => x.type)).toContain(
      'PAYMENT_REQUEST',
    );
    const file = await as('director')
      .get(`/documents/${res.body.document.id}/download`)
      .buffer(true)
      .parse((r, callback) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const zip = await JSZip.loadAsync(file.body as Buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('1.000.000');
    expect(xml).toContain('TT HD-2026-T07E');
    expect(
      Object.keys(zip.files).some(
        (n) => n.startsWith('word/media/') && n.endsWith('.png'),
      ),
    ).toBe(true);
    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'GENERATE_PAYMENT_REQUEST', entityId: contractId },
    });
    expect(audit).not.toBeNull();
  });

  it('quyền: nhân viên, KTT (không có payments:create), quản trị → 403', async () => {
    for (const who of ['staff', 'manager', 'admin'] as const) {
      await as(who)
        .post('/payments/payment-requests/preview')
        .send(body([ids['Đợt 2']]))
        .expect(403);
      await as(who)
        .post('/payments/payment-requests')
        .send(body([ids['Đợt 2']]))
        .expect(403);
    }
  });
});
