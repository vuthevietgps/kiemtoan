import { createTestContext, TestContext } from './utils/test-app';

interface CustomerBody {
  id: string;
  taxCode: string;
  owner: { id: string; fullName: string } | null;
  contractCount?: number;
  contracts?: { id: string; code: string; total: string }[];
  documentCount?: number;
  openTaskCount?: number;
}

interface ListBody<T> {
  items: T[];
  total: number;
}

describe('Customers (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('Khách hàng', () => {
    it('kế toán trưởng tạo khách hàng, giao cho nhân viên', async () => {
      const res = await ctx
        .api(ctx.users.manager)
        .post('/customers')
        .send({
          name: 'Công ty CP ABC',
          taxCode: '0101234567',
          taxPeriod: 'QUARTERLY',
          contactEmail: 'ketoan@abc.vn',
          ownerId: ctx.users.staff.id,
        })
        .expect(201);
      const body = res.body as CustomerBody;
      customerId = body.id;
      expect(body.owner?.id).toBe(ctx.users.staff.id);
    });

    it('trùng mã số thuế trả 409', async () => {
      const res = await ctx
        .api(ctx.users.director)
        .post('/customers')
        .send({ name: 'Trùng', taxCode: '0101234567' })
        .expect(409);
      expect((res.body as { message: string }).message).toBe(
        'Mã số thuế đã tồn tại',
      );
    });

    it('mã số thuế sai định dạng trả 400', async () => {
      await ctx
        .api(ctx.users.director)
        .post('/customers')
        .send({ name: 'Sai MST', taxCode: '123' })
        .expect(400);
    });

    it('thu ngân không được tạo khách hàng (403)', async () => {
      await ctx
        .api(ctx.users.cashier)
        .post('/customers')
        .send({ name: 'X', taxCode: '0109999999' })
        .expect(403);
    });

    it('danh sách: tìm theo MST, kèm người phụ trách và số hợp đồng', async () => {
      await ctx.prisma.contract.create({
        data: {
          code: 'HD-TEST-001',
          customerId,
          startDate: new Date('2025-01-01'),
          total: '11000000',
        },
      });
      const res = await ctx
        .api(ctx.users.director)
        .get('/customers?search=0101234')
        .expect(200);
      const body = res.body as ListBody<CustomerBody>;
      expect(body.total).toBe(1);
      expect(body.items[0].owner?.fullName).toBe('Test staff');
      expect(body.items[0].contractCount).toBe(1);
    });

    it('chi tiết kèm hợp đồng tóm tắt và bộ đếm', async () => {
      const res = await ctx
        .api(ctx.users.staff)
        .get(`/customers/${customerId}`)
        .expect(200);
      const body = res.body as CustomerBody;
      expect(body.contracts?.[0].code).toBe('HD-TEST-001');
      expect(body.contracts?.[0]).not.toHaveProperty('total');
      const finance = await ctx
        .api(ctx.users.manager)
        .get(`/customers/${customerId}`)
        .expect(200);
      expect((finance.body as CustomerBody).contracts?.[0].total).toBe(
        '11000000',
      );
      expect(body.documentCount).toBe(0);
      expect(body.openTaskCount).toBe(0);
    });

    it('nhân viên không thấy khách hàng của người khác', async () => {
      const list = await ctx
        .api(ctx.users.staff2)
        .get('/customers')
        .expect(200);
      expect((list.body as ListBody<CustomerBody>).total).toBe(0);
      const options = await ctx
        .api(ctx.users.staff2)
        .get('/customers/options')
        .expect(200);
      expect(options.body).toEqual([]);
      await ctx
        .api(ctx.users.staff2)
        .get(`/customers/${customerId}`)
        .expect(404);
    });

    it('options trả đúng dạng {id, name, taxCode}', async () => {
      const res = await ctx
        .api(ctx.users.staff)
        .get('/customers/options')
        .expect(200);
      expect(res.body).toEqual([
        { id: customerId, name: 'Công ty CP ABC', taxCode: '0101234567' },
      ]);
    });

    it('cập nhật khách hàng', async () => {
      const res = await ctx
        .api(ctx.users.manager)
        .patch(`/customers/${customerId}`)
        .send({ status: 'PAUSED', address: 'Hà Nội' })
        .expect(200);
      expect((res.body as { status: string }).status).toBe('PAUSED');
    });
  });
  it('xoá mềm khách hàng: không còn trong danh sách', async () => {
    await ctx
      .api(ctx.users.manager)
      .delete(`/customers/${customerId}`)
      .expect(200);
    await ctx
      .api(ctx.users.director)
      .get(`/customers/${customerId}`)
      .expect(404);
    const row = await ctx.prisma.customer.findUnique({
      where: { id: customerId },
    });
    expect(row?.deletedAt).not.toBeNull();
  });
});
