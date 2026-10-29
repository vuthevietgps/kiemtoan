/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { ContractStatus, Role } from '@prisma/client';
import { createTestContext, TestContext } from './utils/test-app';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const PDF = Buffer.from('%PDF-1.4\nsao ke ngan hang\n%%EOF');

/**
 * 07-C: vòng đời phiếu thu (J1–J8) — Nháp không tính tiền; chứng từ khi gửi duyệt; không tự duyệt;
 * trả lại / sửa / gửi lại; duyệt đồng thời; huỷ có lý do khôi phục công nợ; rút phiếu; quyền.
 */
describe('07-C vòng đời phiếu thu (e2e)', () => {
  let ctx: TestContext;
  let contractId: string;
  let pendingContractId: string;
  let installmentId: string;
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const detail = (id: string) =>
    as('director').get(`/payments/${id}`).expect(200);
  const contract = async () =>
    (await as('director').get(`/contracts/${contractId}`).expect(200)).body;
  const draft = async (
    who: keyof TestContext['users'],
    body: Record<string, unknown> = {},
  ) =>
    (
      await as(who)
        .post('/payments')
        .send({
          contractId,
          amount: '1000000',
          paidDate: '2026-10-01',
          method: 'CASH',
          documentNumber: 'PT-GIAY-1',
          ...body,
        })
        .expect(201)
    ).body.id as string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const customer = await ctx.prisma.customer.create({
      data: {
        name: 'Công ty Thu Tiền',
        taxCode: '0100007301',
        ownerId: ctx.users.staff.id,
      },
    });
    const base = {
      customerId: customer.id,
      startDate: d('2026-01-01'),
      subtotal: '5000000',
      vatRate: 0,
      vatAmount: '0',
      total: '5000000',
    };
    const c = await ctx.prisma.contract.create({
      data: {
        ...base,
        code: 'HD-2026-T07C',
        status: ContractStatus.IN_PROGRESS,
        installments: {
          create: {
            name: 'Đợt 1',
            amount: '5000000',
            dueDate: d('2026-03-31'),
          },
        },
      },
      include: { installments: true },
    });
    contractId = c.id;
    installmentId = c.installments[0].id;
    pendingContractId = (
      await ctx.prisma.contract.create({
        data: { ...base, code: 'HD-2026-T07P', status: 'PENDING_APPROVAL' },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.prisma.user.updateMany({
      where: { id: ctx.users.manager.id },
      data: { accessRoleId: null },
    });
    await ctx.app.close();
  });

  it('lập phiếu: Nháp chưa tính đã thu; HĐ chờ duyệt, ngày tương lai, thu vượt (tính cả phiếu nháp) → 400', async () => {
    const id = await draft('cashier', { installmentId });
    expect((await detail(id)).body).toMatchObject({
      status: 'DRAFT',
      revision: 1,
      events: [{ toStatus: 'DRAFT', actorName: 'Test cashier' }],
    });
    expect((await contract()).paidAmount).toBe('0');
    await as('cashier')
      .post('/payments')
      .send({
        contractId: pendingContractId,
        amount: '1',
        paidDate: '2026-10-01',
      })
      .expect(400);
    await as('cashier')
      .post('/payments')
      .send({ contractId, amount: '1', paidDate: '2099-01-01' })
      .expect(400);
    const over = await as('cashier')
      .post('/payments')
      .send({ contractId, amount: '4000001', paidDate: '2026-10-01' })
      .expect(400);
    expect(over.body.message).toBe('Số tiền thu vượt quá số còn phải thu');
    // Rút phiếu (người lập) → Đã huỷ, giải phóng giới hạn.
    await as('cashier')
      .post(`/payments/${id}/withdraw`)
      .send({ revision: 1 })
      .expect(200);
    expect((await detail(id)).body.status).toBe('CANCELLED');
  });

  it('J8: chuyển khoản cần file chứng từ; tiền mặt cần số phiếu giấy; một file dùng lại cho phiếu khác', async () => {
    const transfer = await draft('cashier', {
      method: 'BANK_TRANSFER',
      documentNumber: null,
      amount: '500000',
    });
    const noFile = await as('cashier')
      .post(`/payments/${transfer}/submit`)
      .send({ revision: 1 })
      .expect(400);
    expect(noFile.body.message).toMatch(/ít nhất một file/);
    const uploaded = await as('cashier')
      .post(`/payments/${transfer}/documents`)
      .attach('file', PDF, 'sao-ke.pdf')
      .expect(201);
    const doc = await ctx.prisma.document.findUniqueOrThrow({
      where: { id: uploaded.body.documentId },
    });
    expect(doc).toMatchObject({ category: 'PAYMENT', contractId });
    await as('cashier')
      .post(`/payments/${transfer}/submit`)
      .send({ revision: 1 })
      .expect(200);
    const cash = await draft('cashier', {
      documentNumber: '',
      amount: '100000',
    });
    await as('cashier')
      .post(`/payments/${cash}/submit`)
      .send({ revision: 1 })
      .expect(400);
    const second = await draft('cashier', {
      method: 'BANK_TRANSFER',
      amount: '100000',
    });
    await as('cashier')
      .post(`/payments/${second}/documents`)
      .send({ documentId: doc.id })
      .expect(201);
    await as('cashier')
      .post(`/payments/${second}/submit`)
      .send({ revision: 1 })
      .expect(200);
    expect((await detail(second)).body.documents).toEqual([
      { id: doc.id, fileName: 'sao-ke.pdf' },
    ]);
    const c = await contract();
    expect(c).toMatchObject({ paidAmount: '0', pendingAmount: '600000' });
  });

  it('J1: người lập không tự duyệt; KTT không có quyền duyệt; trả lại cần lý do → người lập sửa, gửi lại; người khác không sửa được', async () => {
    const own = await draft('director', { amount: '200000' });
    await as('director')
      .post(`/payments/${own}/submit`)
      .send({ revision: 1 })
      .expect(200);
    await as('director')
      .post(`/payments/${own}/approve`)
      .send({ revision: 2 })
      .expect(403);
    const id = await draft('cashier', { amount: '300000' });
    await as('cashier')
      .post(`/payments/${id}/submit`)
      .send({ revision: 1 })
      .expect(200);
    await as('manager')
      .post(`/payments/${id}/approve`)
      .send({ revision: 2 })
      .expect(403);
    await as('cashier')
      .post(`/payments/${id}/approve`)
      .send({ revision: 2 })
      .expect(403);
    await as('director')
      .post(`/payments/${id}/return`)
      .send({ revision: 2, reason: 'Sai' })
      .expect(400);
    await as('director')
      .post(`/payments/${id}/return`)
      .send({ revision: 2, reason: 'Thiếu số phiếu giấy đúng' })
      .expect(200);
    await as('director')
      .patch(`/payments/${id}`)
      .send({ revision: 3, documentNumber: 'X' })
      .expect(403);
    await as('cashier')
      .patch(`/payments/${id}`)
      .send({ revision: 3, documentNumber: 'PT-GIAY-2', amount: '350000' })
      .expect(200);
    await as('cashier')
      .post(`/payments/${id}/submit`)
      .send({ revision: 4 })
      .expect(200);
    const body = (await detail(id)).body;
    expect(body).toMatchObject({
      status: 'PENDING',
      amount: '350000',
      returnReason: null,
    });
    expect(body.events.map((e: { toStatus: string }) => e.toStatus)).toEqual([
      'DRAFT',
      'PENDING',
      'RETURNED',
      'PENDING',
    ]);
  });

  it('duyệt đồng thời chỉ một lần; duyệt tính đã thu và phân bổ; huỷ cần lý do, khôi phục công nợ, giữ lịch sử', async () => {
    const id = await draft('cashier', { amount: '400000', installmentId });
    await as('cashier')
      .post(`/payments/${id}/submit`)
      .send({ revision: 1 })
      .expect(200);
    const results = await Promise.all([
      as('director').post(`/payments/${id}/approve`).send({ revision: 2 }),
      as('director').post(`/payments/${id}/approve`).send({ revision: 2 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    // Bấm lại trên bản cũ sau khi phiếu đã được duyệt: vẫn là xung đột (409), không phải lỗi trạng thái.
    await as('director')
      .post(`/payments/${id}/approve`)
      .send({ revision: 2 })
      .expect(409);
    let c = await contract();
    expect(c.paidAmount).toBe('400000');
    expect(c.installments[0].paidAmount).toBe('400000');
    expect((await detail(id)).body).toMatchObject({
      status: 'APPROVED',
      approvedByName: 'Test director',
      allocations: [{ amount: '400000', installment: { id: installmentId } }],
    });
    await as('director')
      .post(`/payments/${id}/cancel`)
      .send({ revision: 3, reason: '' })
      .expect(400);
    await as('cashier')
      .post(`/payments/${id}/cancel`)
      .send({ revision: 3, reason: 'Nhập nhầm hợp đồng' })
      .expect(403);
    await as('director')
      .post(`/payments/${id}/cancel`)
      .send({ revision: 3, reason: 'Nhập nhầm hợp đồng' })
      .expect(200);
    c = await contract();
    expect(c.paidAmount).toBe('0');
    expect(c.installments[0].paidAmount).toBe('0');
    const body = (await detail(id)).body;
    expect(body).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'Nhập nhầm hợp đồng',
      cancelledByName: 'Test director',
      allocations: [],
    });
    expect(body.events).toHaveLength(4);
    await as('director').delete(`/payments/${id}`).expect(410);
  });

  it('phân quyền: nhân viên/quản trị 403; vai trò tuỳ chỉnh cấp payments:approve cho KTT có hiệu lực ngay, thu lại thì 403', async () => {
    for (const who of ['staff', 'admin'] as const) {
      await as(who).get('/payments').expect(403);
      await as(who)
        .post('/payments')
        .send({ contractId, amount: '1', paidDate: '2026-10-01' })
        .expect(403);
    }
    const ids: string[] = [];
    for (const amount of ['100000', '50000']) {
      const id = await draft('cashier', { amount });
      await as('cashier')
        .post(`/payments/${id}/submit`)
        .send({ revision: 1 })
        .expect(200);
      ids.push(id);
    }
    const role = await ctx.prisma.accessRole.create({
      data: {
        name: `KTT duyệt thu ${Date.now()}`,
        baseRole: Role.MANAGER,
        scope: 'TEAM',
        permissions: [
          'payments:view',
          'payments:approve',
          'contracts:view',
          'finance:view',
        ],
        createdById: ctx.users.director.id,
      },
    });
    await ctx.prisma.user.update({
      where: { id: ctx.users.manager.id },
      data: { accessRoleId: role.id },
    });
    await as('manager')
      .post(`/payments/${ids[0]}/approve`)
      .send({ revision: 2 })
      .expect(200);
    await ctx.prisma.accessRole.update({
      where: { id: role.id },
      data: {
        permissions: ['payments:view', 'contracts:view', 'finance:view'],
      },
    });
    await as('manager')
      .post(`/payments/${ids[1]}/approve`)
      .send({ revision: 2 })
      .expect(403);
  });
});
