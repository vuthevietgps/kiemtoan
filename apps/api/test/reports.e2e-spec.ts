import request from 'supertest';
import { todayVn } from '../src/modules/reports/utils/period.util';
import { seedReportData } from './utils/report-fixtures';
import { createTestContext, TestContext } from './utils/test-app';
import { relogin } from './utils/auth-flow';

/** 10-D (M4): giá trị HĐ theo ngày duyệt (`contractValue`), kèm đã xuất hoá đơn / đã thu. */
interface RevenueBody {
  rows: { name: string; contracts: number; contractValue: string }[];
  totals: { contracts: number; contractValue: string };
}
interface ReceivablesBody {
  rows: {
    customerName: string;
    total: string;
    paid: string;
    remaining: string;
    overdue: string;
  }[];
}
/** 10-E: Đánh giá năng lực — tab Trợ lý (G4–G6), không có số tiền. */
interface CapabilityBody {
  rows: {
    user: { id: string; fullName: string };
    total: number;
    onTime: number;
    late: number;
    overdue: number;
    rate: number | null;
  }[];
}

describe('Reports & Audit log (e2e)', () => {
  let ctx: TestContext;
  const year = todayVn().getUTCFullYear();
  const range = `from=${year - 1}-01-01&to=${year + 1}-12-31`;

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedReportData(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('doanh thu theo khách hàng (bỏ hợp đồng nháp)', async () => {
    const res = await ctx
      .api(ctx.users.director)
      .get(`/reports/revenue?groupBy=customer&${range}`)
      .expect(200);
    const body = res.body as RevenueBody;
    expect(
      body.rows.map((r) => [r.name, r.contracts, Number(r.contractValue)]),
    ).toEqual([
      ['Công ty B', 1, 2_000_000],
      ['Công ty A', 2, 1_500_000],
    ]);
    expect(Number(body.totals.contractValue)).toBe(3_500_000);
  });

  it('nhân viên được cấp quyền tiền chỉ thấy doanh thu khách hàng của mình', async () => {
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.staff.id}/access-requests`)
      .send({ role: 'STAFF', financialAccess: true })
      .expect(201);
    await relogin(ctx, ctx.users.staff);
    const res = await ctx
      .api(ctx.users.staff)
      .get(`/reports/revenue?groupBy=owner&${range}`)
      .expect(200);
    const body = res.body as RevenueBody;
    expect(body.totals.contracts).toBe(2);
    expect(Number(body.totals.contractValue)).toBe(1_500_000);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.staff.id}/access-requests`)
      .send({ role: 'STAFF', financialAccess: false })
      .expect(201);
    await relogin(ctx, ctx.users.staff);
  });

  it('công nợ: đã thu, còn lại, quá hạn theo đợt thanh toán', async () => {
    const res = await ctx
      .api(ctx.users.cashier)
      .get('/reports/receivables')
      .expect(200);
    const rows = (res.body as ReceivablesBody).rows.map((r) => [
      r.customerName,
      Number(r.total),
      Number(r.paid),
      Number(r.remaining),
      Number(r.overdue),
    ]);
    expect(rows).toEqual([
      ['Công ty B', 2_200_000, 0, 2_200_000, 1_000_000],
      ['Công ty A', 1_650_000, 300_000, 1_350_000, 0],
    ]);
  });

  it('đánh giá năng lực trợ lý: việc xong sau hạn là trễ, không có tiền', async () => {
    const res = await ctx
      .api(ctx.users.director)
      .get(`/reports/capability?role=ASSISTANT&${range}`)
      .expect(200);
    const row = (res.body as CapabilityBody).rows.find(
      (r) => r.user.fullName === 'Test staff',
    );
    expect(row).toMatchObject({ total: 3, onTime: 0, late: 1, overdue: 0 });
    expect(row?.rate).toBe(0);
    expect(JSON.stringify(res.body)).not.toContain('revenue');
  });

  it('đánh giá năng lực: nhân viên chỉ thấy chính mình (G9)', async () => {
    const res = await ctx
      .api(ctx.users.staff)
      .get(`/reports/capability?${range}`)
      .expect(200);
    const rows = (res.body as CapabilityBody).rows;
    expect(rows.map((r) => r.user.fullName)).toEqual(['Test staff']);
    const items = await ctx
      .api(ctx.users.staff)
      .get(`/reports/capability/${ctx.users.staff.id}?${range}`)
      .expect(200);
    expect((items.body as { tasks: unknown[] }).tasks).toHaveLength(3);
    await ctx
      .api(ctx.users.staff)
      .get(`/reports/capability/${ctx.users.staff2.id}?${range}`)
      .expect(403);
  });

  it('xuất CSV UTF-8 có BOM, tải được qua link ?token=', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(
        `/api/v1/reports/receivables?format=csv&token=${ctx.users.manager.token}`,
      )
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const body = res.body as Buffer;
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body.toString('utf8')).toContain('Công ty A');
  });

  it('nhân viên không có quyền xuất CSV (403)', async () => {
    await ctx
      .api(ctx.users.staff)
      .get('/reports/revenue?format=csv')
      .expect(403);
  });

  it('quản trị không xem được báo cáo (403)', async () => {
    await ctx.api(ctx.users.admin).get('/reports/receivables').expect(403);
  });

  describe('Nhật ký hoạt động', () => {
    it('nhân viên không xem được nhật ký (403)', async () => {
      await ctx.api(ctx.users.staff).get('/audit-logs').expect(403);
    });

    it('quản trị xem nhật ký, lọc theo module và hành động, kèm người dùng', async () => {
      await ctx
        .api(ctx.users.admin)
        .patch(`/users/${ctx.users.staff2.id}`)
        .send({ title: 'Kế toán viên' })
        .expect(200);
      // Interceptor ghi nhật ký bất đồng bộ — chờ bản ghi xuất hiện.
      for (let i = 0; i < 20; i++) {
        const n = await ctx.prisma.auditLog.count({
          where: { entity: 'users' },
        });
        if (n > 0) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      const res = await ctx
        .api(ctx.users.admin)
        .get('/audit-logs?entity=users&action=UPDATE')
        .expect(200);
      const body = res.body as {
        total: number;
        items: { entityId: string; user: { email: string } }[];
      };
      expect(body.total).toBe(1);
      expect(body.items[0].entityId).toBe(ctx.users.staff2.id);
      expect(body.items[0].user.email).toBe('admin@test.vn');

      const entities = await ctx
        .api(ctx.users.admin)
        .get('/audit-logs/entities')
        .expect(200);
      expect(entities.body).toContain('users');
    });

    it('lọc theo khoảng ngày', async () => {
      const res = await ctx
        .api(ctx.users.admin)
        .get('/audit-logs?from=2000-01-01&to=2000-01-31')
        .expect(200);
      expect((res.body as { total: number }).total).toBe(0);
    });
  });
});
