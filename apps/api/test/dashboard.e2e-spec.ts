import { ContractStatus, ServiceStatus } from '@prisma/client';
import {
  addDays,
  currentMonth,
  formatBusinessDate,
  previousPeriod,
  todayVn,
} from '../src/modules/reports/utils/period.util';
import { seedReportData } from './utils/report-fixtures';
import { createTestContext, TestContext } from './utils/test-app';
import { relogin } from './utils/auth-flow';

interface Money {
  value: string;
  previous: string;
  changePercent: number | null;
}
interface DashboardBody {
  kpis: {
    revenue: Money;
    totalPayable: Money;
    contracts: { total: number; new: number };
    servicesDone: number;
    servicesTotal: number;
  };
  revenueByServiceType: { name: string; amount: string }[];
  serviceStatus: { completed: number; notCompleted: number };
  paymentStatus: { paid: string; remaining: string };
  recentContracts: { code: string; customerName: string; paidAmount: string }[];
}

/** 10-B tab Tài chính (M1, M4, M5): như tổng quan demo, chỉ người có quyền tài chính; HĐ theo ngày duyệt. */
describe('Dashboard tài chính (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedReportData(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const load = async (key: 'director' | 'staff') =>
    (await ctx.api(ctx.users[key]).get('/dashboard/finance').expect(200))
      .body as DashboardBody;

  it('giám đốc thấy số liệu toàn công ty, so với kỳ trước', async () => {
    const body = await load('director');
    expect(Number(body.kpis.revenue.value)).toBe(3_000_000);
    expect(Number(body.kpis.revenue.previous)).toBe(500_000);
    expect(body.kpis.revenue.changePercent).toBe(500);
    expect(Number(body.kpis.totalPayable.value)).toBe(3_300_000);
    expect(body.kpis.contracts).toEqual({ total: 3, new: 2 });
    expect(body.kpis.servicesDone).toBe(1);
    expect(body.kpis.servicesTotal).toBe(3);
    expect(body.serviceStatus).toEqual({ completed: 1, notCompleted: 2 });
    expect(
      body.revenueByServiceType.map((r) => [r.name, Number(r.amount)]),
    ).toEqual([
      ['Kế toán thuế', 2_600_000],
      ['Kiểm toán', 400_000],
    ]);
    // Phiếu thu đã xoá không được tính
    expect(Number(body.paymentStatus.paid)).toBe(300_000);
    expect(Number(body.paymentStatus.remaining)).toBe(3_000_000);
    expect(body.recentContracts).toHaveLength(4);
  });

  it('nhân viên: không có quyền tài chính → 403; được cấp thì chỉ thấy số liệu khách hàng của mình', async () => {
    await ctx.api(ctx.users.staff).get('/dashboard/finance').expect(403);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.staff.id}/access-requests`)
      .send({ role: 'STAFF', financialAccess: true })
      .expect(201);
    await relogin(ctx, ctx.users.staff);
    const body = await load('staff');
    expect(Number(body.kpis.revenue.value)).toBe(1_000_000);
    expect(body.kpis.revenue.changePercent).toBe(100);
    expect(body.kpis.servicesTotal).toBe(2);
    expect(
      body.recentContracts.every((c) => c.customerName === 'Công ty A'),
    ).toBe(true);
    const c1 = body.recentContracts.find((c) => c.code === 'HD-T-001');
    expect(Number(c1?.paidAmount)).toBe(300_000);
  });

  it('lọc theo khoảng ngày: kỳ trước chỉ có hợp đồng cũ', async () => {
    const prev = previousPeriod(currentMonth());
    const res = await ctx
      .api(ctx.users.director)
      .get(
        `/dashboard/finance?from=${formatBusinessDate(prev.from)}&to=${formatBusinessDate(prev.to)}`,
      )
      .expect(200);
    const body = res.body as DashboardBody;
    expect(Number(body.kpis.revenue.value)).toBe(500_000);
    expect(body.kpis.contracts.new).toBe(1);
    // M5: kỳ so sánh (trước kỳ trước) bằng 0 → không so được.
    expect(body.kpis.revenue.changePercent).toBeNull();
  });

  it('khoảng ngày ngược bị từ chối (400)', async () => {
    const today = todayVn();
    await ctx
      .api(ctx.users.director)
      .get(
        `/dashboard/finance?from=${formatBusinessDate(today)}&to=${formatBusinessDate(addDays(today, -1))}`,
      )
      .expect(400);
  });

  it('quản trị hệ thống không có quyền xem tổng quan (403)', async () => {
    await ctx.api(ctx.users.admin).get('/dashboard/finance').expect(403);
    await ctx.api(ctx.users.admin).get('/dashboard/operations').expect(403);
  });

  it('dữ liệu mẫu đúng trạng thái', async () => {
    const draft = await ctx.prisma.contract.count({
      where: { status: ContractStatus.DRAFT },
    });
    const done = await ctx.prisma.contractService.count({
      where: { status: ServiceStatus.COMPLETED },
    });
    expect([draft, done]).toEqual([1, 1]);
  });
});
