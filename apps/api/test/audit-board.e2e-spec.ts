/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

const inDays = (days: number) => {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  )
    .toISOString()
    .slice(0, 10);
};

type Who = keyof TestContext['users'];

describe('04-F3 bảng theo dõi HĐ kiểm toán (e2e)', () => {
  let ctx: TestContext;
  let audit: string;
  let other: string;
  /** HĐ A: hai dòng kiểm toán (2024, 2025) + một dòng thường; HĐ B: một dòng kiểm toán 2025. */
  let a: { id: string; lines: string[] };
  let b: { id: string; lines: string[] };

  const as = (who: Who) => ctx.api(ctx.users[who]);
  const id = (who: Who) => ctx.users[who].id;
  const board = (who: Who, query = '') =>
    as(who).get(`/contracts/audit-tracking?${query}`);
  const create = async (customerId: string, services: object[]) => {
    const res = await as('manager')
      .post('/contracts')
      .send({
        customerId,
        startDate: '2026-01-01',
        signedDate: '2025-12-20',
        vatRate: 10,
        services,
      })
      .expect(201);
    await as('manager').post(`/contracts/${res.body.id}/submit`).expect(200);
    await as('director').post(`/contracts/${res.body.id}/approve`).expect(200);
    const lines = await ctx.prisma.contractService.findMany({
      where: { contractId: res.body.id, serviceTypeId: audit },
      orderBy: { period: 'asc' },
    });
    return {
      id: res.body.id as string,
      code: res.body.code as string,
      lines: lines.map((l) => l.id),
    };
  };
  const line = (period: string, unitPrice: string, serviceTypeId = audit) => ({
    serviceTypeId,
    period,
    quantity: 1,
    unitPrice,
  });

  beforeAll(async () => {
    ctx = await createTestContext();
    audit = (
      await ctx.prisma.serviceType.create({
        data: { code: 'KT', name: 'Kiểm toán', issuesAuditReport: true },
      })
    ).id;
    other = (
      await ctx.prisma.serviceType.create({
        data: { code: 'KTT', name: 'Kế toán thuế' },
      })
    ).id;
    const alpha = await ctx.prisma.customer.create({
      data: {
        name: 'Công ty Alpha',
        taxCode: '0100000111',
        ownerId: id('staff'),
      },
    });
    const beta = await ctx.prisma.customer.create({
      data: {
        name: 'Công ty Beta',
        taxCode: '0100000222',
        ownerId: id('manager'),
      },
    });
    a = await create(alpha.id, [
      line('2024', '1000000'),
      line('2025', '2000000'),
      line('2026-01', '500000', other),
    ]);
    b = await create(beta.id, [line('2025', '4000000')]);
    // HĐ A dòng 2025: đã phát hành, chưa có hoá đơn; hạn kết thúc kiểm toán đã quá.
    const url = (c: string, l: string) =>
      `/contracts/${c}/audit-engagements/${l}`;
    await as('manager')
      .put(url(a.id, a.lines[1]))
      .send({
        revision: 0,
        managerId: id('manager'),
        leadId: id('staff'),
        signer1Id: id('director'),
        fieldworkDue: inDays(-5),
        issueDue: inDays(20),
      })
      .expect(200);
    for (const [stage, revision] of [
      ['FIELDWORK', 1],
      ['REVIEW', 2],
      ['AWAITING_ISSUE', 3],
    ] as const)
      await as('manager')
        .post(`${url(a.id, a.lines[1])}/stage`)
        .send({ stage, revision })
        .expect(200);
    await as('director')
      .post(`${url(a.id, a.lines[1])}/issue`)
      .field('revision', '4')
      .field('reportNumber', 'ALPHA-25')
      .field('reportDate', inDays(0))
      .expect(200);
    // HĐ B: đang kiểm toán, hạn kết thúc kiểm toán đã quá và chưa đạt.
    await as('manager')
      .put(url(b.id, b.lines[0]))
      .send({
        revision: 0,
        managerId: id('manager'),
        leadId: id('staff'),
        fieldworkDue: inDays(-2),
        issueDue: inDays(3),
      })
      .expect(200);
    await as('manager')
      .post(`${url(b.id, b.lines[0])}/stage`)
      .send({ stage: 'FIELDWORK', revision: 1 })
      .expect(200);
    await ctx.prisma.payment.create({
      data: {
        code: 'PT-TEST-1',
        contractId: a.id,
        amount: '1300000',
        paidDate: new Date(),
        receivedById: id('cashier'),
        // 07-C: chỉ phiếu Đã duyệt tính đã thu — giữ ý nghĩa fixture (phiếu đã thu).
        status: 'APPROVED',
      },
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('mỗi dòng là một hồ sơ kiểm toán; thẻ đếm; tiền theo HĐ không cộng trùng', async () => {
    const res = await board('director').expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.summary).toMatchObject({
      total: 3,
      byStage: { NOT_STARTED: 1, FIELDWORK: 1, ISSUED: 1 },
      overdue: 1,
      dueSoon: 1,
      totalContractValue: '8250000',
      paidAmount: '1300000',
      remainingAmount: '6950000',
    });
    const issued = res.body.items.find(
      (i: { reportNumber: string | null }) => i.reportNumber === 'ALPHA-25',
    );
    expect(issued).toMatchObject({
      year: 2025,
      stage: 'ISSUED',
      manager: { id: id('manager') },
      lead: { id: id('staff') },
      signer1: { id: id('director') },
      invoice: 'NONE',
      issueDeadline: { currentDue: inDays(20), result: 'ON_TIME' },
      deadlineFlags: { late: true },
      dossier: { clientDeliveryStatus: 'NOT_SENT' },
      amount: '2000000',
      totalContractValue: '3850000',
      paidAmount: '1300000',
      remainingAmount: '2550000',
    });
  });

  it('bộ lọc: tìm, năm, giai đoạn, người, tình trạng hạn, chưa hoá đơn, còn phải thu; sắp xếp và phân trang', async () => {
    expect(
      (await board('director', 'search=beta').expect(200)).body.total,
    ).toBe(1);
    expect(
      (await board('director', 'search=alpha-25').expect(200)).body.items[0]
        .reportNumber,
    ).toBe('ALPHA-25');
    expect(
      (await board('director', 'search=0100000111').expect(200)).body.total,
    ).toBe(2);
    expect((await board('director', 'year=2024').expect(200)).body.total).toBe(
      1,
    );
    expect(
      (await board('director', 'stage=NOT_STARTED').expect(200)).body.total,
    ).toBe(1);
    expect(
      (await board('director', 'stage=FIELDWORK').expect(200)).body.total,
    ).toBe(1);
    expect(
      (await board('director', `signerId=${id('director')}`).expect(200)).body
        .total,
    ).toBe(1);
    expect(
      (await board('director', `leadId=${id('staff')}`).expect(200)).body.total,
    ).toBe(2);
    const overdue = await board('director', 'deadline=OVERDUE').expect(200);
    expect(overdue.body.items.map((i: { lineId: string }) => i.lineId)).toEqual(
      [b.lines[0]],
    );
    expect(
      (await board('director', 'deadline=LATE').expect(200)).body.total,
    ).toBe(1);
    expect(
      (await board('director', 'uninvoiced=true').expect(200)).body.total,
    ).toBe(1);
    expect(
      (await board('director', 'dossierIncomplete=true').expect(200)).body
        .total,
    ).toBe(3);
    expect(
      (await board('director', 'receivable=true').expect(200)).body.total,
    ).toBe(3);
    const sorted = await board('director', 'sort=issueDue&order=asc').expect(
      200,
    );
    expect(
      sorted.body.items.map(
        (i: { issueDeadline: { currentDue: string } | null }) =>
          i.issueDeadline?.currentDue ?? null,
      ),
    ).toEqual([inDays(3), inDays(20), null]);
    const paged = await board('director', 'pageSize=2&page=2&sort=code').expect(
      200,
    );
    expect(paged.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(paged.body.items).toHaveLength(1);
    await board('director', 'pageSize=500').expect(400);
    await board('director', 'deadline=XYZ').expect(400);
  });

  it('phạm vi và quyền: nhân viên không thấy tiền; thu tiền thấy tiền; ngoài phạm vi rỗng; quản trị 403', async () => {
    const staff = await board('staff').expect(200);
    expect(staff.body.total).toBe(2);
    expect(staff.body.items[0]).not.toHaveProperty('amount');
    expect(staff.body.items[0]).not.toHaveProperty('remainingAmount');
    expect(staff.body.summary).not.toHaveProperty('totalContractValue');
    expect(
      (await board('staff', 'receivable=true').expect(200)).body.total,
    ).toBe(2);
    const cashier = await board('cashier').expect(200);
    expect(cashier.body.items[0]).toHaveProperty('remainingAmount');
    expect((await board('staff2').expect(200)).body.total).toBe(0);
    await board('admin').expect(403);
  });
});
