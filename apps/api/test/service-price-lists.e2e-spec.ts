/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

/** Ngày nghiệp vụ theo giờ Việt Nam, lệch `offset` ngày so với hôm nay, dạng YYYY-MM-DD. */
function vnDate(offset = 0): string {
  const moment = Date.now() + 7 * 3_600_000 + offset * 86_400_000;
  return new Date(moment).toISOString().slice(0, 10);
}

const TIERS = [
  { minValue: '0', maxValue: '100', unitPrice: '1000000' },
  { minValue: '100', maxValue: '300', unitPrice: '2000000' },
  { minValue: '300', maxValue: null, unitPrice: '3000000' },
];

describe('Service price lists (e2e)', () => {
  let ctx: TestContext;
  let serviceId: string;
  let flatServiceId: string;
  let activeListId: string;

  const base = () => `/service-types/${serviceId}`;

  beforeAll(async () => {
    ctx = await createTestContext();
    const created = await ctx
      .api(ctx.users.director)
      .post('/service-types')
      .send({
        code: 'ktt',
        name: 'Kế toán thuế',
        cycle: 'MONTHLY',
        defaultPrice: '500000',
        pricingBasis: 'DOCUMENT_COUNT',
        pricingUnit: ' chứng từ/tháng ',
      })
      .expect(201);
    serviceId = created.body.id;
    expect(created.body.pricingUnit).toBe('chứng từ/tháng');
    const flat = await ctx
      .api(ctx.users.director)
      .post('/service-types')
      .send({ code: 'BCTC', name: 'Báo cáo tài chính', cycle: 'YEARLY' })
      .expect(201);
    flatServiceId = flat.body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('giám đốc tạo bảng giá áp dụng từ hôm nay; tiêu chí được chụp từ dịch vụ', async () => {
    const res = await ctx
      .api(ctx.users.director)
      .post(`${base()}/price-lists`)
      .send({ effectiveFrom: vnDate(), note: 'Bảng giá 2026', tiers: TIERS })
      .expect(201);
    activeListId = res.body.id;
    expect(res.body.pricingBasis).toBe('DOCUMENT_COUNT');
    expect(res.body.pricingUnit).toBe('chứng từ/tháng');
    expect(
      res.body.tiers.map((t: { unitPrice: string }) => t.unitPrice),
    ).toEqual(['1000000', '2000000', '3000000']);
    const log = await ctx.prisma.auditLog.findFirst({
      where: { action: 'PRICE_LIST_CREATE', entityId: serviceId },
    });
    expect(log?.detail).toMatchObject({
      before: null,
      after: {
        tiers: [
          ['0', '100', '1000000'],
          ['100', '300', '2000000'],
          ['300', null, '3000000'],
        ],
      },
    });
  });

  it('phân quyền: chỉ người có quyền tài chính xem, chỉ giám đốc ghi', async () => {
    const { manager, staff, cashier, admin } = ctx.users;
    await ctx.api(manager).get(`${base()}/price-lists`).expect(200);
    await ctx.api(cashier).get(`${base()}/price-lists`).expect(200);
    await ctx.api(staff).get(`${base()}/price-lists`).expect(403);
    await ctx.api(staff).get(`${base()}/price-quote?value=10`).expect(403);
    await ctx.api(admin).get(`${base()}/price-lists`).expect(403);
    const body = { effectiveFrom: vnDate(5), tiers: TIERS };
    await ctx.api(manager).post(`${base()}/price-lists`).send(body).expect(403);
    await ctx.api(cashier).post(`${base()}/price-lists`).send(body).expect(403);
    await ctx.api(staff).post(`${base()}/price-lists`).send(body).expect(403);
  });

  it('bậc hở hoặc chồng lấn bị từ chối và chỉ rõ bậc lỗi', async () => {
    const gap = await ctx
      .api(ctx.users.director)
      .post(`${base()}/price-lists`)
      .send({
        effectiveFrom: vnDate(3),
        tiers: [
          { minValue: '0', maxValue: '100', unitPrice: '1' },
          { minValue: '150', unitPrice: '2' },
        ],
      })
      .expect(400);
    expect(gap.body.message).toMatch(/^Bậc 2: phải bắt đầu đúng/);
    await ctx
      .api(ctx.users.director)
      .post(`${base()}/price-lists`)
      .send({
        effectiveFrom: vnDate(3),
        tiers: [
          { minValue: '0', maxValue: '100', unitPrice: '1' },
          { minValue: '90', unitPrice: '2' },
        ],
      })
      .expect(400);
  });

  it('dịch vụ không theo bậc chỉ nhận một mức giá', async () => {
    await ctx
      .api(ctx.users.director)
      .post(`/service-types/${flatServiceId}/price-lists`)
      .send({ effectiveFrom: vnDate(), tiers: TIERS })
      .expect(400);
    await ctx
      .api(ctx.users.director)
      .post(`/service-types/${flatServiceId}/price-lists`)
      .send({
        effectiveFrom: vnDate(),
        tiers: [{ minValue: '0', maxValue: null, unitPrice: '15000000' }],
      })
      .expect(201);
    const quote = await ctx
      .api(ctx.users.director)
      .get(`/service-types/${flatServiceId}/price-quote`)
      .expect(200);
    expect(quote.body).toMatchObject({
      unitPrice: '15000000',
      fallback: false,
    });
  });

  it('không cho lùi ngày hiệu lực về trước hôm nay và không trùng ngày', async () => {
    await ctx
      .api(ctx.users.director)
      .post(`${base()}/price-lists`)
      .send({ effectiveFrom: vnDate(-1), tiers: TIERS })
      .expect(400);
    await ctx
      .api(ctx.users.director)
      .post(`${base()}/price-lists`)
      .send({ effectiveFrom: vnDate(), tiers: TIERS })
      .expect(409);
  });

  it('tạo đồng thời cùng ngày hiệu lực: đúng một bảng được ghi', async () => {
    const body = { effectiveFrom: vnDate(20), tiers: TIERS };
    const results = await Promise.all(
      [1, 2].map(() =>
        ctx.api(ctx.users.director).post(`${base()}/price-lists`).send(body),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('báo giá chọn đúng bậc tại biên và dùng giá chuẩn khi chưa có bảng', async () => {
    const quote = (query: string) =>
      ctx.api(ctx.users.cashier).get(`${base()}/price-quote${query}`);
    expect((await quote('?value=99.99').expect(200)).body.unitPrice).toBe(
      '1000000',
    );
    expect((await quote('?value=100').expect(200)).body.unitPrice).toBe(
      '2000000',
    );
    expect((await quote('?value=5000').expect(200)).body).toMatchObject({
      unitPrice: '3000000',
      fallback: false,
      priceListId: activeListId,
    });
    expect(
      (await quote(`?value=10&date=${vnDate(-1)}`).expect(200)).body,
    ).toMatchObject({
      unitPrice: '500000',
      fallback: true,
      reason: 'NO_PRICE_LIST',
    });
    await quote('').expect(400);
  });

  it('bảng đang áp dụng không sửa/xoá được; bảng sắp áp dụng thì được', async () => {
    const director = ctx.api(ctx.users.director);
    await director
      .put(`${base()}/price-lists/${activeListId}`)
      .send({ effectiveFrom: vnDate(1), tiers: TIERS })
      .expect(409);
    await director.delete(`${base()}/price-lists/${activeListId}`).expect(409);

    const future = await director
      .post(`${base()}/price-lists`)
      .send({ effectiveFrom: vnDate(10), tiers: TIERS })
      .expect(201);
    const updated = await director
      .put(`${base()}/price-lists/${future.body.id}`)
      .send({
        effectiveFrom: vnDate(11),
        tiers: [{ minValue: '0', maxValue: null, unitPrice: '2500000' }],
      })
      .expect(200);
    expect(updated.body.tiers).toHaveLength(1);
    const logs = await ctx.prisma.auditLog.count({
      where: { action: 'PRICE_LIST_UPDATE', entityId: serviceId },
    });
    expect(logs).toBe(1);

    await director
      .delete(`${base()}/price-lists/${future.body.id}`)
      .expect(200);
    const lists = await director.get(`${base()}/price-lists`).expect(200);
    expect(lists.body.map((l: { id: string }) => l.id)).not.toContain(
      future.body.id,
    );
    expect(
      lists.body.find((l: { id: string }) => l.id === activeListId),
    ).toMatchObject({ status: 'ACTIVE', editable: false });
    // Ngày của bảng đã xoá được dùng lại.
    await director
      .post(`${base()}/price-lists`)
      .send({ effectiveFrom: vnDate(11), tiers: TIERS })
      .expect(201);
  });

  it('đổi giá không làm thay đổi đơn giá đã lưu trên hợp đồng', async () => {
    const customer = await ctx.prisma.customer.create({
      data: { name: 'KH giá', taxCode: '0109999001' },
    });
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-PRICE',
        customerId: customer.id,
        startDate: new Date('2026-10-01'),
        services: {
          create: {
            serviceTypeId: serviceId,
            unitPrice: '1200000',
            amount: '1200000',
          },
        },
      },
      include: { services: true },
    });
    await ctx
      .api(ctx.users.director)
      .patch(`/service-types/${serviceId}`)
      .send({ defaultPrice: '900000' })
      .expect(200);
    await ctx
      .api(ctx.users.director)
      .post(`${base()}/price-lists`)
      .send({ effectiveFrom: vnDate(30), tiers: TIERS })
      .expect(201);
    const line = await ctx.prisma.contractService.findUniqueOrThrow({
      where: { id: contract.services[0].id },
    });
    expect(line.unitPrice.toString()).toBe('1200000');
    const log = await ctx.prisma.auditLog.findFirst({
      where: { action: 'SERVICE_UPDATE', entityId: serviceId },
    });
    expect(log?.detail).toEqual({
      before: { defaultPrice: '500000' },
      after: { defaultPrice: '900000' },
    });
  });

  it('lọc dịch vụ theo trạng thái và từ khoá; người thiếu quyền tài chính không thấy giá chuẩn', async () => {
    await ctx
      .api(ctx.users.director)
      .patch(`/service-types/${flatServiceId}`)
      .send({ isActive: false })
      .expect(200);
    const active = await ctx
      .api(ctx.users.staff)
      .get('/service-types?active=true')
      .expect(200);
    expect(active.body.map((s: { code: string }) => s.code)).toEqual(['KTT']);
    expect(active.body[0]).not.toHaveProperty('defaultPrice');
    const inactive = await ctx
      .api(ctx.users.director)
      .get('/service-types?active=false&search=báo cáo')
      .expect(200);
    expect(inactive.body.map((s: { code: string }) => s.code)).toEqual([
      'BCTC',
    ]);
    await ctx
      .api(ctx.users.director)
      .get('/service-types?active=maybe')
      .expect(400);
  });
});
