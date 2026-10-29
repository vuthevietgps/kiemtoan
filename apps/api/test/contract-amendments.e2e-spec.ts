/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';
import { reallocateContract } from '../src/modules/payments/payment-allocation';

describe('Contract amendments (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let serviceA: string;
  let serviceB: string;
  let serviceC: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  /** HĐ đã duyệt: dòng A (đã có việc), dòng B; đợt 1 đã thu đủ. */
  const setup = async () => {
    const res = await as('manager')
      .post('/contracts')
      .send({
        customerId,
        startDate: '2026-11-01',
        vatRate: 10,
        services: [
          {
            serviceTypeId: serviceA,
            period: '2026',
            quantity: 1,
            unitPrice: '1000000',
          },
          {
            serviceTypeId: serviceB,
            period: '2026',
            quantity: 1,
            unitPrice: '1000000',
          },
        ],
        installments: [
          { name: 'Đợt 1', amount: '1100000', dueDate: '2026-11-15' },
          { name: 'Đợt 2', amount: '1100000', dueDate: '2027-01-15' },
        ],
      })
      .expect(201);
    const id = res.body.id as string;
    await as('manager').post(`/contracts/${id}/submit`).expect(200);
    await as('director').post(`/contracts/${id}/approve`).expect(200);
    const lines = await ctx.prisma.contractService.findMany({
      where: { contractId: id },
    });
    const lineA = lines.find((l) => l.serviceTypeId === serviceA)!;
    const lineB = lines.find((l) => l.serviceTypeId === serviceB)!;
    await ctx.prisma.task.create({
      data: {
        customerId,
        contractId: id,
        contractServiceId: lineA.id,
        title: 'Việc dòng A',
        dueDate: new Date('2026-11-20'),
        originalDueDate: new Date('2026-11-20'),
        status: 'IN_PROGRESS',
      },
    });
    const [first] = await ctx.prisma.paymentInstallment.findMany({
      where: { contractId: id },
      orderBy: { sortOrder: 'asc' },
    });
    const payment = await ctx.prisma.payment.create({
      data: {
        code: `PT-TEST-${id.slice(0, 8)}`,
        contractId: id,
        installmentId: first.id,
        amount: '1100000',
        paidDate: new Date('2026-11-10'),
        receivedById: ctx.users.cashier.id,
        // 07-C: chỉ phiếu Đã duyệt tính đã thu — giữ ý nghĩa fixture (đợt 1 đã thu), phân bổ như qua ứng dụng.
        status: 'APPROVED',
      },
    });
    await ctx.prisma.$transaction((tx) => reallocateContract(tx, id));
    return { id, lineA, lineB, first, payment };
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    const create = (code: string, name: string) =>
      ctx.prisma.serviceType.create({ data: { code, name } });
    serviceA = (await create('KTT', 'Kế toán thuế')).id;
    serviceB = (await create('BCTC', 'Báo cáo tài chính')).id;
    serviceC = (await create('BHXH', 'Bảo hiểm xã hội')).id;
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Phụ lục',
          taxCode: '0100000999',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('lập, gửi, duyệt phụ lục: cập nhật dòng, tổng tiền, đợt; giữ trước–sau; đồng thời chỉ một lần', async () => {
    const { id, lineA, lineB, first, payment } = await setup();
    await as('manager')
      .post(`/contracts/${id}/amendments`)
      .send({
        title: 'Bỏ A',
        lines: [{ action: 'REMOVE', contractServiceId: lineA.id }],
      })
      .expect(400);
    await as('staff')
      .post(`/contracts/${id}/amendments`)
      .send({
        title: 'Thử',
        lines: [{ action: 'REMOVE', contractServiceId: lineB.id }],
      })
      .expect(403);
    const created = await as('manager')
      .post(`/contracts/${id}/amendments`)
      .send({
        title: 'Điều chỉnh dịch vụ 2027',
        effectiveDate: '2027-01-01',
        lines: [
          {
            action: 'UPDATE',
            contractServiceId: lineA.id,
            unitPrice: '1500000',
          },
          { action: 'REMOVE', contractServiceId: lineB.id },
          {
            action: 'ADD',
            serviceTypeId: serviceC,
            period: '2027',
            quantity: 2,
            unitPrice: '750000',
          },
        ],
      })
      .expect(201);
    const amendmentId = created.body.id;
    // A 1.500.000 + C 1.500.000 = 3.000.000; VAT 300.000; đợt 1 đã thu giữ nguyên, phần tăng thêm 1 đợt.
    expect(created.body).toMatchObject({
      number: 1,
      status: 'DRAFT',
      total: '3300000',
    });
    expect(created.body.installments).toEqual([
      {
        id: first.id,
        name: 'Đợt 1',
        amount: '1100000.00',
        dueDate: '2026-11-15',
      },
      expect.objectContaining({ name: 'Đợt 2', amount: '1100000.00' }),
      {
        name: 'Bổ sung theo PL-01',
        amount: '1100000.00',
        dueDate: '2027-01-01',
      },
    ]);

    const staffView = await as('staff')
      .get(`/contracts/${id}/amendments`)
      .expect(200);
    expect(staffView.body[0]).not.toHaveProperty('total');
    expect(staffView.body[0]).not.toHaveProperty('installments');
    expect(staffView.body[0].lines[0]).not.toHaveProperty('unitPrice');

    await as('manager')
      .post(`/contracts/${id}/amendments/${amendmentId}/submit`)
      .expect(200);
    await as('manager')
      .post(`/contracts/${id}/amendments/${amendmentId}/approve`)
      .expect(403);
    const results = await Promise.all(
      [1, 2].map(() =>
        as('director').post(
          `/contracts/${id}/amendments/${amendmentId}/approve`,
        ),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

    const contract = await ctx.prisma.contract.findUniqueOrThrow({
      where: { id },
      include: {
        services: true,
        installments: { orderBy: { sortOrder: 'asc' } },
      },
    });
    expect(
      [contract.subtotal, contract.vatAmount, contract.total].map((v) =>
        v.toFixed(2),
      ),
    ).toEqual(['3000000.00', '300000.00', '3300000.00']);
    expect(
      contract.services
        .map((s) => [s.serviceTypeId, s.unitPrice.toFixed(0)])
        .sort(),
    ).toEqual(
      [
        [serviceA, '1500000'],
        [serviceC, '750000'],
      ].sort(),
    );
    const added = contract.services.find((s) => s.serviceTypeId === serviceC)!;
    expect(added).toMatchObject({
      period: '2027',
      taskGenerationStatus: 'PENDING',
    });
    expect(contract.installments.map((i) => i.amount.toFixed(0))).toEqual([
      '1100000',
      '1100000',
      '1100000',
    ]);
    expect(
      await ctx.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
    ).toMatchObject({ installmentId: first.id });
    const stored = await ctx.prisma.contractAmendment.findUniqueOrThrow({
      where: { id: amendmentId },
    });
    expect(stored).toMatchObject({
      status: 'APPROVED',
      approvedById: ctx.users.director.id,
    });
    expect((stored.before as { total: string }).total).toBe('2200000.00');
    expect((stored.after as { total: string }).total).toBe('3300000.00');

    const history = await as('staff')
      .get(`/contracts/${id}/history`)
      .expect(200);
    // Bản ghi chung của interceptor cho cùng thao tác bị lọc, không lặp dòng.
    expect(
      history.body.items.filter((h: { detail: { path?: string } }) =>
        h.detail.path?.endsWith('/approve'),
      ),
    ).toEqual([]);
    const approve = history.body.items.find(
      (h: { action: string }) => h.action === 'AMENDMENT_APPROVE',
    );
    expect(approve.detail).toEqual({
      number: 'PL-01',
      title: 'Điều chỉnh dịch vụ 2027',
      from: 'PENDING_APPROVAL',
      to: 'APPROVED',
    });
  });

  it('trả lại có lý do, sửa nháp; phụ lục lập trên số liệu cũ không duyệt được', async () => {
    const { id, lineB } = await setup();
    const make = (unitPrice: string) =>
      as('manager')
        .post(`/contracts/${id}/amendments`)
        .send({
          title: `Giá B ${unitPrice}`,
          lines: [{ action: 'UPDATE', contractServiceId: lineB.id, unitPrice }],
        })
        .expect(201);
    const one = (await make('1200000')).body.id;
    const two = (await make('1300000')).body.id;
    expect(
      (
        await ctx.prisma.contractAmendment.findUniqueOrThrow({
          where: { id: two },
        })
      ).number,
    ).toBe(2);
    for (const amendment of [one, two])
      await as('manager')
        .post(`/contracts/${id}/amendments/${amendment}/submit`)
        .expect(200);

    await as('manager')
      .post(`/contracts/${id}/amendments/${one}/return`)
      .send({ reason: 'Sửa lại giá' })
      .expect(403);
    await as('director')
      .post(`/contracts/${id}/amendments/${one}/return`)
      .send({ reason: 'Sửa lại giá' })
      .expect(200);
    const edited = await as('manager')
      .put(`/contracts/${id}/amendments/${one}`)
      .send({
        title: 'Giá B 1.250.000',
        lines: [
          {
            action: 'UPDATE',
            contractServiceId: lineB.id,
            unitPrice: '1250000',
          },
        ],
      })
      .expect(200);
    expect(edited.body).toMatchObject({
      returnedReason: null,
      total: '2475000',
    });
    await as('manager')
      .post(`/contracts/${id}/amendments/${one}/submit`)
      .expect(200);
    await as('director')
      .post(`/contracts/${id}/amendments/${one}/approve`)
      .expect(200);
    // Phụ lục 2 tính trên tổng cũ → phải trả lại cập nhật.
    await as('director')
      .post(`/contracts/${id}/amendments/${two}/approve`)
      .expect(409);
    await as('manager')
      .post(`/contracts/${id}/amendments/${two}/cancel`)
      .expect(200);
    await as('manager')
      .put(`/contracts/${id}/amendments/${two}`)
      .send({
        title: 'x',
        lines: [{ action: 'REMOVE', contractServiceId: lineB.id }],
      })
      .expect(400);
  });

  it('không lập phụ lục cho HĐ chưa duyệt; người ngoài phạm vi nhận 404', async () => {
    const draft = await as('manager')
      .post('/contracts')
      .send({
        customerId,
        startDate: '2026-11-01',
        services: [
          { serviceTypeId: serviceA, quantity: 1, unitPrice: '1000000' },
        ],
      })
      .expect(201);
    const line = await ctx.prisma.contractService.findFirstOrThrow({
      where: { contractId: draft.body.id },
    });
    await as('manager')
      .post(`/contracts/${draft.body.id}/amendments`)
      .send({
        title: 'Thử',
        lines: [{ action: 'UPDATE', contractServiceId: line.id, quantity: 2 }],
      })
      .expect(400);
    await as('staff2')
      .get(`/contracts/${draft.body.id}/amendments`)
      .expect(404);
    await as('admin').get(`/contracts/${draft.body.id}/amendments`).expect(403);
  });
});
