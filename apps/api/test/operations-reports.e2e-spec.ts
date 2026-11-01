/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { seedOperationsReport } from './utils/operations-report-fixtures';
import { createTestContext, TestContext } from './utils/test-app';

/**
 * 10-C báo cáo vận hành (M6–M8): đúng định nghĩa trên bộ dữ liệu có ca biên, danh sách chi tiết tái lập
 * con số, phạm vi theo vai trò, giá trị HĐ chỉ khi có quyền tài chính, quyền xem / xuất Excel.
 */
describe('10-C báo cáo vận hành (e2e)', () => {
  let ctx: TestContext;
  let query: { from: string; to: string };
  let ids: Record<string, string>;
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const get = async (
    who: keyof TestContext['users'],
    path: string,
    extra = {},
  ) =>
    (
      await as(who)
        .get(path)
        .query({ ...query, ...extra })
        .expect(200)
    ).body;

  beforeAll(async () => {
    ctx = await createTestContext();
    const seeded = await seedOperationsReport(ctx);
    query = seeded.period;
    ids = seeded.ids;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('M6 tuân thủ deadline: nộp đúng ngày hạn = đúng hạn, trễ do khách, quá hạn, chưa đến hạn; bỏ "Không áp dụng"; theo phạm vi', async () => {
    const staff = await get('staff', '/reports/deadline-compliance');
    expect(staff.summary).toEqual({
      onTime: 1,
      late: 2, // K2 trễ 3 ngày (do khách) + việc pháp lý trễ 1 ngày
      overdue: 1,
      notDue: 1,
      clientDelay: 1,
      onTimeRate: 25,
    });
    expect(
      staff.items.map(
        (i: { title: string; outcome: string; daysLate: number }) => [
          i.title,
          i.outcome,
          i.daysLate,
        ],
      ),
    ).toEqual([
      ['Tờ khai GTGT kỳ K1', 'ON_TIME', 0],
      ['Tờ khai GTGT kỳ K2', 'LATE', 3],
      ['Tờ khai GTGT kỳ K3', 'OVERDUE', 30],
      ['Nộp báo cáo thống kê', 'LATE', 1],
      ['Tờ khai GTGT kỳ K4', 'NOT_DUE', 0],
    ]);
    const director = await get('director', '/reports/deadline-compliance');
    expect(director.summary).toMatchObject({ onTime: 2, onTimeRate: 40 });
    expect(director.byCustomer).toHaveLength(2);
    const total = director.byMonth.reduce(
      (
        n: number,
        m: { onTime: number; late: number; overdue: number; notDue: number },
      ) => n + m.onTime + m.late + m.overdue + m.notDue,
      0,
    );
    expect(total).toBe(director.items.length);
    const onlyB = await get('director', '/reports/deadline-compliance', {
      customerId: ids.b,
    });
    expect(onlyB.items).toHaveLength(1);
  });

  it('M7 hợp đồng: mới duyệt, hiệu lực cuối kỳ, sắp hết hạn, tỷ lệ tái ký; tiền chỉ khi có quyền tài chính', async () => {
    const director = await get('director', '/reports/contracts');
    expect(director.summary).toEqual({
      newApproved: 2,
      active: 3,
      expiring: 1,
      ended: 2,
      renewed: 1,
      renewalRate: 50,
    });
    const cats = (code: string) =>
      director.items.find((i: { code: string }) => i.code === code)?.categories;
    expect(cats('RPT-C1')).toEqual(['NEW', 'ACTIVE']);
    expect(cats('RPT-C2')).toEqual(['ENDED', 'RENEWED']);
    expect(cats('RPT-C4')).toEqual(['ENDED']);
    expect(cats('RPT-C5')).toEqual(['ACTIVE', 'EXPIRING']);
    expect(cats('RPT-C6')).toBeUndefined(); // nháp
    expect(director.items[0]).toHaveProperty('subtotal');
    const staff = await get('staff', '/reports/contracts');
    expect(staff.items.map((i: { code: string }) => i.code).sort()).toEqual([
      'RPT-C2',
      'RPT-C3',
    ]);
    expect(JSON.stringify(staff)).not.toContain('subtotal');
  });

  it('M8 khách hàng: mới, ngừng, giữ chân theo hợp đồng; tái ký trong kỳ thì vẫn giữ chân', async () => {
    const body = await get('director', '/reports/customers');
    expect(body.summary).toEqual({
      newCustomers: 1,
      stopped: 1,
      activeAtStart: 3,
      activeAtEnd: 3,
      retained: 2,
      retentionRate: 66.7,
    });
    const row = (name: string) =>
      body.items.find((i: { name: string }) => i.name === name);
    expect(row('Công ty Báo cáo A')).toMatchObject({
      retained: true,
      stopped: false,
    });
    expect(row('Công ty Báo cáo B')).toMatchObject({
      stopped: true,
      retained: false,
    });
    expect(row('Công ty Báo cáo D')).toMatchObject({ isNew: true });
  });

  it('quyền: thu tiền không xem báo cáo vận hành; nhân viên không xuất Excel; KTT xuất được file Excel thật', async () => {
    for (const path of ['deadline-compliance', 'contracts', 'customers']) {
      await as('cashier').get(`/reports/${path}`).expect(403);
      await as('staff').get(`/reports/${path}/export`).expect(403);
      const file = await as('manager')
        .get(`/reports/${path}/export`)
        .query(query)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(file.headers['content-type']).toContain('spreadsheetml');
      expect((file.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    }
    await as('admin').get('/reports/customers').expect(403);
  });
});
