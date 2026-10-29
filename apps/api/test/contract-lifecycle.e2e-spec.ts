/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

const iso = (date: Date) => date.toISOString().slice(0, 10);
const inDays = (days: number) => {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return iso(
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + days,
      ),
    ),
  );
};

describe('Contract lifecycle: business info, cancel, renewal, expiring (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let serviceA: string;
  let serviceB: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const createContract = async (extra: Record<string, unknown> = {}) => {
    const res = await as('manager')
      .post('/contracts')
      .send({
        customerId,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
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
            period: '2026-Q4',
            quantity: 2,
            unitPrice: '500000',
          },
        ],
        installments: [
          { name: 'Đợt 1', amount: '1100000', dueDate: '2026-02-01' },
          { name: 'Đợt 2', amount: '1100000', dueDate: '2026-08-01' },
        ],
        ...extra,
      })
      .expect(201);
    return res.body.id as string;
  };
  const approved = async (extra: Record<string, unknown> = {}) => {
    const id = await createContract(extra);
    await as('manager').post(`/contracts/${id}/submit`).expect(200);
    await as('director').post(`/contracts/${id}/approve`).expect(200);
    return id;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    serviceA = (
      await ctx.prisma.serviceType.create({
        data: { code: 'KTT', name: 'Kế toán thuế' },
      })
    ).id;
    serviceB = (
      await ctx.prisma.serviceType.create({
        data: { code: 'BCTC', name: 'Báo cáo tài chính' },
      })
    ).id;
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Vòng đời',
          taxCode: '0100000888',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('lưu người phụ trách kinh doanh, người giới thiệu; sửa sau duyệt có audit, không sửa tiền', async () => {
    const id = await approved({
      salesOwnerId: ctx.users.manager.id,
      referrerName: 'Anh Giới Thiệu',
      referrerPhone: '0900000000',
    });
    const detail = await as('director').get(`/contracts/${id}`).expect(200);
    expect(detail.body).toMatchObject({
      salesOwner: { id: ctx.users.manager.id, fullName: 'Test manager' },
      referrerName: 'Anh Giới Thiệu',
    });
    await as('staff')
      .patch(`/contracts/${id}/business-info`)
      .send({ note: 'x' })
      .expect(403);
    await as('manager')
      .patch(`/contracts/${id}/business-info`)
      .send({ salesOwnerId: '00000000-0000-4000-8000-000000000000' })
      .expect(400);
    await as('manager')
      .patch(`/contracts/${id}/business-info`)
      .send({ total: '1' })
      .expect(400);
    const res = await as('manager')
      .patch(`/contracts/${id}/business-info`)
      .send({
        referrerName: 'Chị Mới',
        signedDate: '2026-01-05',
        note: 'Ghi chú sau duyệt',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      referrerName: 'Chị Mới',
      note: 'Ghi chú sau duyệt',
    });
    const log = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entityId: id, action: 'UPDATE_INFO' },
    });
    expect((log.detail as { fields: string[] }).fields.sort()).toEqual([
      'note',
      'referrerName',
      'signedDate',
    ]);
  });

  it('huỷ HĐ đã có việc bắt buộc lý do, giữ nguyên việc và huỷ phụ lục đang mở', async () => {
    const id = await approved();
    const line = await ctx.prisma.contractService.findFirstOrThrow({
      where: { contractId: id },
    });
    const task = await ctx.prisma.task.create({
      data: {
        customerId,
        contractId: id,
        contractServiceId: line.id,
        title: 'Việc đã sinh',
        dueDate: new Date('2026-02-10'),
        originalDueDate: new Date('2026-02-10'),
      },
    });
    await as('manager')
      .post(`/contracts/${id}/amendments`)
      .send({
        title: 'Tăng giá',
        lines: [
          {
            action: 'UPDATE',
            contractServiceId: line.id,
            unitPrice: '1200000',
          },
        ],
      })
      .expect(201);
    await as('manager')
      .post(`/contracts/${id}/status`)
      .send({ status: 'CANCELLED' })
      .expect(400);
    await as('manager')
      .post(`/contracts/${id}/status`)
      .send({ status: 'CANCELLED', reason: 'Khách dừng dịch vụ' })
      .expect(200);
    const contract = await ctx.prisma.contract.findUniqueOrThrow({
      where: { id },
    });
    expect(contract).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'Khách dừng dịch vụ',
      cancelledById: ctx.users.manager.id,
    });
    expect(
      await ctx.prisma.task.findUniqueOrThrow({ where: { id: task.id } }),
    ).toMatchObject({
      deletedAt: null,
      status: 'NOT_STARTED',
    });
    expect(
      await ctx.prisma.contractAmendment.count({
        where: { contractId: id, status: 'CANCELLED' },
      }),
    ).toBe(1);
    await as('manager')
      .patch(`/contracts/${id}/business-info`)
      .send({ note: 'x' })
      .expect(400);
  });

  it('tạo HĐ năm sau: chép dòng, kỳ và đợt dời một năm; chỉ một HĐ tái ký còn hiệu lực', async () => {
    const draft = await createContract();
    await as('manager').post(`/contracts/${draft}/renew`).expect(400);
    const id = await approved({
      salesOwnerId: ctx.users.manager.id,
      referrerName: 'Anh A',
    });
    await as('staff').post(`/contracts/${id}/renew`).expect(403);
    const results = await Promise.all(
      [1, 2].map(() => as('manager').post(`/contracts/${id}/renew`)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const created = results.find((r) => r.status === 201)!.body;
    const renewal = await ctx.prisma.contract.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        services: { orderBy: { period: 'asc' } },
        installments: { orderBy: { sortOrder: 'asc' } },
      },
    });
    expect(renewal).toMatchObject({
      status: 'DRAFT',
      renewedFromId: id,
      salesOwnerId: ctx.users.manager.id,
      referrerName: 'Anh A',
      signedDate: null,
    });
    expect(iso(renewal.startDate)).toBe('2027-01-01');
    expect(iso(renewal.endDate!)).toBe('2027-12-31');
    expect(renewal.total.toFixed(0)).toBe('2200000');
    expect(renewal.services.map((s) => s.period)).toEqual(['2027', '2027-Q4']);
    expect(
      renewal.installments.map((i) => [iso(i.dueDate), i.amount.toFixed(0)]),
    ).toEqual([
      ['2027-02-01', '1100000'],
      ['2027-08-01', '1100000'],
    ]);
    const detail = await as('manager').get(`/contracts/${id}`).expect(200);
    expect(detail.body.renewals).toEqual([
      { id: created.id, code: created.code, status: 'DRAFT' },
    ]);
    // Huỷ HĐ tái ký thì được tái ký lại.
    await as('manager')
      .post(`/contracts/${created.id}/status`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    await as('manager').post(`/contracts/${id}/renew`).expect(201);
  });

  it('danh sách sắp hết hạn theo số ngày và phạm vi; tỷ lệ tái ký', async () => {
    const soon = await approved({
      startDate: inDays(-300),
      endDate: inDays(10),
    });
    const later = await approved({
      startDate: inDays(-300),
      endDate: inDays(60),
    });
    const thirty = await as('manager').get('/contracts/expiring').expect(200);
    const ids = thirty.body.items.map((c: { id: string }) => c.id);
    expect(ids).toContain(soon);
    expect(ids).not.toContain(later);
    expect(
      thirty.body.items.find((c: { id: string }) => c.id === soon),
    ).toMatchObject({
      daysLeft: 10,
      renewals: [],
    });
    const short = await as('manager')
      .get('/contracts/expiring?days=5')
      .expect(200);
    expect(short.body.items.map((c: { id: string }) => c.id)).not.toContain(
      soon,
    );
    const outOfScope = await as('staff2')
      .get('/contracts/expiring?days=90')
      .expect(200);
    expect(outOfScope.body.items).toEqual([]);
    await as('admin').get('/contracts/expiring').expect(403);

    const range = `/contracts/renewal-stats?from=${inDays(5)}&to=${inDays(15)}`;
    const before = await as('manager').get(range).expect(200);
    expect(before.body).toMatchObject({ total: 1, renewed: 0, rate: 0 });
    await as('manager').post(`/contracts/${soon}/renew`).expect(201);
    const after = await as('manager').get(range).expect(200);
    expect(after.body).toMatchObject({ total: 1, renewed: 1, rate: 1 });
  });
});
