import { seedCapabilityData } from './utils/capability-fixtures';
import { createTestContext, TestContext } from './utils/test-app';

/** 10-E: Đánh giá năng lực theo khung G1–G10 (dữ liệu: `capability-fixtures.ts`). */
interface Row {
  user: { id: string; fullName: string };
  [key: string]: unknown;
}
interface Report {
  rows: Row[];
}

describe('Capability evaluation (e2e)', () => {
  let ctx: TestContext;
  const may = 'from=2026-05-01&to=2026-05-31';

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedCapabilityData(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const report = async (as: keyof TestContext['users'], query: string) => {
    const res = await ctx
      .api(ctx.users[as])
      .get(`/reports/capability?${may}&${query}`)
      .expect(200);
    return (res.body as Report).rows;
  };
  const rowOf = (rows: Row[], key: keyof TestContext['users']) =>
    rows.find((r) => r.user.id === ctx.users[key].id);

  it('trợ lý: đúng hạn theo lần nộp đầu, chờ khách đã xác nhận, hạn pháp lý, hạn gốc, gia hạn, bị trả lại', async () => {
    const rows = await report('director', 'role=ASSISTANT');
    expect(rowOf(rows, 'staff')).toMatchObject({
      total: 5,
      onTime: 2,
      late: 2,
      overdue: 1,
      rate: 40,
      rateOriginal: 20,
      statutoryLate: 1,
      clientDelay: 1,
      // Gia hạn đếm từng lần; trả lại 2 lần vẫn là 1 việc bị trả lại trên 4 việc đã nộp.
      extensions: 2,
      submitted: 4,
      returned: 1,
      returnRate: 25,
      accepted: 2,
      openCustomers: 1,
    });
    expect(rowOf(rows, 'staff2')).toMatchObject({ total: 1, onTime: 1 });
  });

  it('lọc mảng kế toán / kiểm toán, không cộng hai mảng', async () => {
    const accounting = await report('director', 'domain=ACCOUNTING');
    expect(rowOf(accounting, 'staff')).toMatchObject({ total: 4, overdue: 0 });
    const audit = await report('director', 'domain=AUDIT');
    expect(rowOf(audit, 'staff')).toMatchObject({ total: 1, overdue: 1 });
  });

  it('danh sách việc tái lập được con số (việc chuyển đổi thiếu mốc ghi rõ không tính)', async () => {
    const res = await ctx
      .api(ctx.users.director)
      .get(`/reports/capability/${ctx.users.staff.id}?${may}`)
      .expect(200);
    const tasks = (
      res.body as {
        tasks: {
          title: string;
          counted: boolean;
          result: string;
          waitDays: number;
          milestone: string | null;
        }[];
      }
    ).tasks;
    expect(tasks).toHaveLength(6);
    const byTitle = new Map(tasks.map((t) => [t.title, t]));
    expect(byTitle.get('T5')?.counted).toBe(false);
    expect(byTitle.get('T1')).toMatchObject({
      result: 'ON_TIME',
      milestone: '2026-05-10',
    });
    expect(byTitle.get('T3')).toMatchObject({ result: 'LATE', waitDays: 3 });
  });

  it('trưởng nhóm: kỳ dịch vụ gán cho người giữ vai lúc hạn đến; soát xét và SLA', async () => {
    const rows = await report('director', 'role=LEAD&domain=ACCOUNTING');
    const manager = rowOf(rows, 'manager')!;
    expect(manager.periods).toMatchObject({ total: 1, late: 1, rate: 0 });
    expect(manager.reviews).toMatchObject({
      count: 2,
      withinSla: 1,
      slaRate: 50,
      returned: 1,
      overSlaNow: 0,
    });
    expect(manager.audit).toBeNull();
    expect(rowOf(rows, 'director')!.periods).toMatchObject({
      total: 1,
      rate: 100,
      rateOriginal: 0,
      extendedRate: 100,
    });
  });

  it('manager: mọi kỳ dịch vụ trong suốt kỳ giữ vai', async () => {
    const rows = await report('director', 'role=MANAGER&domain=ACCOUNTING');
    expect(rowOf(rows, 'manager')!.periods).toMatchObject({
      total: 2,
      onTime: 1,
      rate: 50,
      extendedRate: 50,
    });
    expect(rowOf(rows, 'manager')).not.toHaveProperty('reviews');
  });

  it('G9: KTT xem người trong nhóm, nhân viên chỉ chính mình', async () => {
    const assistants = await report('manager', 'role=ASSISTANT');
    expect(rowOf(assistants, 'staff')).toBeDefined();
    expect(rowOf(assistants, 'staff2')).toBeUndefined();
    const leads = await report('manager', 'role=LEAD&domain=ACCOUNTING');
    expect(leads.map((r) => r.user.id)).toEqual([ctx.users.manager.id]);
    const own = await report('staff2', 'role=ASSISTANT');
    expect(own.map((r) => r.user.id)).toEqual([ctx.users.staff2.id]);
    await ctx
      .api(ctx.users.manager)
      .get(`/reports/capability/${ctx.users.staff2.id}?${may}`)
      .expect(403);
  });

  it('Excel cần quyền xuất, ghi nhật ký EXPORT; không có số tiền', async () => {
    await ctx
      .api(ctx.users.director)
      .get(`/reports/capability/export?${may}&role=LEAD`)
      .expect(200)
      .expect('Content-Type', /spreadsheetml/);
    // Nhật ký ghi sau khi phản hồi đã gửi: chờ tối đa 2 giây.
    const logged = () =>
      ctx.prisma.auditLog.count({
        where: { action: 'EXPORT', entity: 'reports' },
      });
    for (let i = 0; i < 20 && !(await logged()); i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await logged()).toBeGreaterThan(0);
    await ctx
      .api(ctx.users.staff)
      .get(`/reports/capability/export?${may}`)
      .expect(403);
    const rows = await report('director', 'role=LEAD');
    for (const key of ['amount', 'revenue', 'contractValue'])
      expect(JSON.stringify(rows)).not.toContain(key);
  });
});
