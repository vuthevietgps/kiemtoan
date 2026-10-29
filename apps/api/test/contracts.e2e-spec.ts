/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CONTRACT_APPROVED } from '../src/common/events/app-events';
import { createTestContext, TestContext } from './utils/test-app';

/** Luồng chính: hợp đồng → duyệt → thu tiền → công nợ → hoá đơn, kèm kiểm tra quyền & phạm vi. */
describe('Contracts, payments, invoices (e2e)', () => {
  let ctx: TestContext;
  let serviceTypeId: string;
  let ownCustomerId: string;
  let otherCustomerId: string;
  let contractId: string;
  let invoiceId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const st = await ctx.prisma.serviceType.create({
      data: { code: 'KTT', name: 'Kế toán thuế', cycle: 'MONTHLY' },
    });
    serviceTypeId = st.id;
    ownCustomerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty A',
          taxCode: '0100000001',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    otherCustomerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty B',
          taxCode: '0100000002',
          ownerId: ctx.users.staff2.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const body = (customerId: string, installments?: unknown[]) => ({
    customerId,
    startDate: '2025-01-01',
    vatRate: 10,
    services: [
      {
        serviceTypeId,
        period: '2025',
        quantity: 12,
        unitPrice: '1500000',
        assigneeId: ctx.users.staff.id,
      },
    ],
    installments,
  });

  it('tạo hợp đồng: tự sinh mã, tính tiền', async () => {
    const res = await ctx
      .api(ctx.users.manager)
      .post('/contracts')
      .send(
        body(ownCustomerId, [
          { name: 'Tạm ứng', amount: '9900000', dueDate: '2025-01-15' },
          { name: 'Đợt 2', amount: 9900000, dueDate: '2025-06-30' },
        ]),
      )
      .expect(201);
    expect(res.body.code).toMatch(/^HD-\d{4}-001$/);
    expect(res.body.subtotal).toBe('18000000');
    expect(res.body.vatAmount).toBe('1800000');
    expect(res.body.total).toBe('19800000');
    expect(res.body.status).toBe('DRAFT');
    contractId = res.body.id;
  });

  it('tổng các đợt khác tổng tiền → 400', async () => {
    await ctx
      .api(ctx.users.manager)
      .post('/contracts')
      .send(
        body(ownCustomerId, [
          { name: 'Đợt 1', amount: '1000', dueDate: '2025-01-15' },
        ]),
      )
      .expect(400);
  });

  it('hợp đồng nháp không thu tiền được', async () => {
    await ctx
      .api(ctx.users.cashier)
      .post('/payments')
      .send({ contractId, amount: '1000', paidDate: '2025-01-10' })
      .expect(400);
  });

  it('nhân viên và trưởng nhóm không duyệt được hợp đồng (403)', async () => {
    await ctx
      .api(ctx.users.staff)
      .post(`/contracts/${contractId}/approve`)
      .expect(403);
    await ctx
      .api(ctx.users.manager)
      .post(`/contracts/${contractId}/approve`)
      .expect(403);
  });

  it('gửi duyệt rồi giám đốc duyệt, phát sự kiện contract.approved', async () => {
    const submitted = await ctx
      .api(ctx.users.manager)
      .post(`/contracts/${contractId}/submit`)
      .expect(200);
    expect(submitted.body.status).toBe('PENDING_APPROVAL');

    const emit = jest.spyOn(ctx.app.get(EventEmitter2), 'emitAsync');
    const res = await ctx
      .api(ctx.users.director)
      .post(`/contracts/${contractId}/approve`)
      .expect(200);
    expect(res.body.status).toBe('NOT_STARTED');
    expect(res.body.approvedById).toBe(ctx.users.director.id);
    expect(emit).toHaveBeenCalledWith(CONTRACT_APPROVED, {
      contractId,
      approvedById: ctx.users.director.id,
    });
    emit.mockRestore();
    const log = await ctx.prisma.auditLog.findFirst({
      where: { action: 'APPROVE', entityId: contractId },
    });
    expect(log).not.toBeNull();
  });

  it('nhân viên không thu tiền được (403)', async () => {
    await ctx
      .api(ctx.users.staff)
      .post('/payments')
      .send({ contractId, amount: '1000', paidDate: '2025-01-10' })
      .expect(403);
  });

  it('thu tiền một phần, thu vượt mức bị chặn', async () => {
    const res = await ctx
      .api(ctx.users.cashier)
      .post('/payments')
      .send({
        contractId,
        amount: '5000000',
        paidDate: '2025-01-10',
        method: 'CASH',
        documentNumber: 'PT-GIAY-01', // 07-C (J8): phiếu tiền mặt cần số phiếu giấy khi gửi duyệt
      })
      .expect(201);
    expect(res.body.code).toBe('PT-2025-001');
    // 07-C (J1/J2): chỉ phiếu Đã duyệt tính đã thu — gửi duyệt rồi GĐ duyệt.
    await ctx
      .api(ctx.users.cashier)
      .post(`/payments/${res.body.id}/submit`)
      .send({ revision: 1 })
      .expect(200);
    await ctx
      .api(ctx.users.director)
      .post(`/payments/${res.body.id}/approve`)
      .send({ revision: 2 })
      .expect(200);
    const over = await ctx
      .api(ctx.users.cashier)
      .post('/payments')
      .send({ contractId, amount: '15000000', paidDate: '2025-01-11' })
      .expect(400);
    expect(over.body.message).toBe('Số tiền thu vượt quá số còn phải thu');
  });

  it('danh sách hợp đồng có trạng thái thanh toán', async () => {
    const res = await ctx
      .api(ctx.users.director)
      .get('/contracts?search=công ty a')
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      paidAmount: '5000000',
      // 07-D2 (đặc tả 07 đã duyệt): thu một phần mà đợt hạn 15/01/2025 còn thiếu → "Còn nợ quá hạn".
      paymentStatus: 'OVERDUE',
      serviceTypes: ['Kế toán thuế'],
      customer: { name: 'Công ty A' },
    });
  });

  it('công nợ: còn phải thu, quá hạn, tuổi nợ', async () => {
    const res = await ctx
      .api(ctx.users.cashier)
      .get('/payments/receivables')
      .expect(200);
    const row = res.body.items.find(
      (r: { contractId: string }) => r.contractId === contractId,
    );
    expect(row).toMatchObject({
      paid: '5000000',
      remaining: '14800000',
      ageBucket: '>90',
    });
    // Cả hai đợt (01/2025, 06/2025) đã quá hạn: 19.8tr - 5tr.
    expect(row.overdueAmount).toBe('14800000');
    expect(res.body.summary.remaining).toBe('14800000');
  });

  it('đề nghị xuất hoá đơn mặc định phần chưa xuất, kế toán thu tiền phát hành', async () => {
    const req = await ctx
      .api(ctx.users.manager)
      .post('/invoices')
      .send({ contractId, note: 'Xuất cả năm' })
      .expect(201);
    expect(req.body).toMatchObject({
      subtotal: '18000000',
      vatAmount: '1800000',
      status: 'REQUESTED',
    });
    invoiceId = req.body.id;

    // 08 (K5, K9): ghi nhận xuất kèm ký hiệu mẫu số, file PDF và revision (multipart).
    const issue = (who: 'staff' | 'cashier') =>
      ctx
        .api(ctx.users[who])
        .post(`/invoices/${invoiceId}/issue`)
        .field('revision', '1')
        .field('templateCode', '1')
        .field('number', '0000123')
        .field('symbol', 'C25TAA')
        .field('issueDate', '2025-01-20')
        .attach('pdf', Buffer.from('%PDF-1.4\nhoa don\n%%EOF'), 'hoa-don.pdf');
    await issue('staff').expect(403);
    const res = await issue('cashier').expect(200);
    expect(res.body.status).toBe('ISSUED');

    await ctx
      .api(ctx.users.manager)
      .post('/invoices')
      .send({ contractId })
      .expect(400);
  });

  it('chi tiết hợp đồng: đợt thanh toán kèm số đã thu, tiến độ công việc', async () => {
    const res = await ctx
      .api(ctx.users.manager)
      .get(`/contracts/${contractId}`)
      .expect(200);
    expect(
      res.body.installments.map((i: { paidAmount: string }) => i.paidAmount),
    ).toEqual(['5000000', '0']);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.taskProgress).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        done: expect.any(Number),
      }),
    );
  });

  it('không sửa được hợp đồng đã duyệt; chuyển trạng thái hợp lệ', async () => {
    await ctx
      .api(ctx.users.manager)
      .patch(`/contracts/${contractId}`)
      .send({ note: 'sửa' })
      .expect(400);
    await ctx
      .api(ctx.users.manager)
      .post(`/contracts/${contractId}/status`)
      .send({ status: 'COMPLETED' })
      .expect(400);
    const res = await ctx
      .api(ctx.users.manager)
      .post(`/contracts/${contractId}/status`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('phạm vi: nhân viên không thấy hợp đồng của khách hàng ngoài phân công', async () => {
    const other = await ctx
      .api(ctx.users.director)
      .post('/contracts')
      .send({
        ...body(otherCustomerId),
        services: [{ serviceTypeId, quantity: 1, unitPrice: '1000000' }],
      })
      .expect(201);
    const list = await ctx.api(ctx.users.staff).get('/contracts').expect(200);
    const ids = list.body.items.map((c: { id: string }) => c.id);
    expect(ids).toContain(contractId);
    expect(ids).not.toContain(other.body.id);
    await ctx
      .api(ctx.users.staff)
      .get(`/contracts/${other.body.id}`)
      .expect(404);
    await ctx
      .api(ctx.users.staff)
      .post('/invoices')
      .send({ contractId: other.body.id })
      .expect(403);
    await ctx
      .api(ctx.users.manager)
      .post('/invoices')
      .send({ contractId: other.body.id })
      .expect(404);
  });

  it('sửa hợp đồng nháp tính lại tiền và đợt mặc định', async () => {
    const created = await ctx
      .api(ctx.users.manager)
      .post('/contracts')
      .send(body(ownCustomerId))
      .expect(201);
    expect(created.body.code).toMatch(/-003$/);
    const res = await ctx
      .api(ctx.users.manager)
      .patch(`/contracts/${created.body.id}`)
      .send({
        services: [{ serviceTypeId, quantity: 2, unitPrice: '1000000' }],
      })
      .expect(200);
    expect(res.body.total).toBe('2200000');
    const detail = await ctx
      .api(ctx.users.manager)
      .get(`/contracts/${created.body.id}`)
      .expect(200);
    expect(detail.body.installments).toHaveLength(1);
    expect(detail.body.installments[0].amount).toBe('2200000');
  });

  // 07-C (J5): không xoá phiếu thu — DELETE trả 410; GĐ huỷ phiếu đã duyệt có lý do, phiếu còn trong danh sách ở trạng thái Đã huỷ và không còn tính đã thu.
  it('không xoá phiếu thu: huỷ có lý do, giữ bản ghi', async () => {
    const list = await ctx
      .api(ctx.users.cashier)
      .get(`/payments?contractId=${contractId}`)
      .expect(200);
    expect(list.body.items[0].contract.code).toMatch(/^HD-/);
    const id = list.body.items[0].id;
    await ctx.api(ctx.users.cashier).delete(`/payments/${id}`).expect(410);
    await ctx
      .api(ctx.users.director)
      .post(`/payments/${id}/cancel`)
      .send({
        revision: list.body.items[0].revision,
        reason: 'Nhập sai số tiền',
      })
      .expect(200);
    const after = await ctx
      .api(ctx.users.cashier)
      .get(`/payments?contractId=${contractId}`)
      .expect(200);
    expect(after.body.items[0]).toMatchObject({ id, status: 'CANCELLED' });
    const detail = await ctx
      .api(ctx.users.director)
      .get(`/contracts/${contractId}`)
      .expect(200);
    expect(detail.body.paidAmount).toBe('0');
  });
});
