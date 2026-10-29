/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { ObligationStatus } from '@prisma/client';
import { ReminderService } from '../src/modules/notifications/reminder.service';
import { createTestContext, TestContext } from './utils/test-app';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
/** Hôm nay theo giờ VN, 'YYYY-MM-DD'. */
const todayVn = () =>
  new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

type Ids = Record<string, string>;

async function seed(ctx: TestContext, ids: Ids) {
  const customer = async (key: string, taxCode: string, ownerId: string) => {
    ids[key] = (
      await ctx.prisma.customer.create({
        data: { name: `Công ty Bảng ${key}`, taxCode, ownerId },
      })
    ).id;
  };
  await customer('A', '0100006501', ctx.users.staff.id);
  await customer('B', '0100006502', ctx.users.staff2.id);
  const type = await ctx.prisma.obligationType.create({
    data: {
      code: 'VD-BANG',
      name: 'Tờ khai bảng',
      family: 'VD-BANG',
      cycle: 'MONTHLY',
      versions: {
        create: {
          versionNo: 1,
          status: 'CONFIRMED',
          effectiveFrom: d('2026-01-01'),
          dueRule: 'MONTH_AFTER_END',
          monthsAfter: 1,
          dueDay: 20,
        },
      },
    },
    include: { versions: true },
  });
  ids.T = type.id;
  const today = todayVn();
  const rows: [string, string, string, string, ObligationStatus, string?][] = [
    ['A1', 'A', '2027-01', '2027-02-20', 'NOT_DUE'],
    ['A2', 'A', '2027-02', '2027-03-20', 'PREPARING'],
    ['ALATE', 'A', '2026-01', '2026-02-20', 'NOT_DUE'],
    ['AFILED', 'A', '2026-02', '2026-03-20', 'FILED', today],
    ['ANA', 'A', '2026-03', '2026-04-20', 'NOT_APPLICABLE'],
    ['B1', 'B', '2027-01', '2027-02-20', 'NOT_DUE'],
  ];
  for (const [key, customerKey, period, due, status, filedAt] of rows)
    ids[key] = (
      await ctx.prisma.customerObligation.create({
        data: {
          customerId: ids[customerKey],
          obligationTypeId: type.id,
          versionId: type.versions[0].id,
          period,
          periodEnd: d(`${period}-28`),
          dueDate: d(due),
          originalDueDate: d(due),
          status,
          filedAt: filedAt ? d(filedAt) : null,
        },
      })
    ).id;
}

/**
 * 06-D2: màn hình Lịch báo cáo — ô đếm theo phạm vi, người phụ trách KH, lọc người phụ trách, tìm
 * kiếm không vượt phạm vi KH (hồi quy), liên kết nhắc lịch báo cáo trỏ màn hình Lịch báo cáo.
 */
describe('06-D2 lịch báo cáo (e2e)', () => {
  let ctx: TestContext;
  const ids: Ids = {};
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const keys = (items: { id: string }[]) =>
    items
      .map((e) => Object.keys(ids).find((k) => ids[k] === e.id) ?? e.id)
      .sort();

  beforeAll(async () => {
    ctx = await createTestContext();
    await seed(ctx, ids);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('hồi quy: tìm kiếm không mở rộng phạm vi KH của nhân viên/trưởng nhóm', async () => {
    const search = (who: keyof TestContext['users']) =>
      as(who)
        .get(`/customer-obligations?search=${encodeURIComponent('Bảng')}`)
        .expect(200);
    expect(keys((await search('staff2')).body.items)).toEqual(['B1']);
    expect(keys((await search('staff')).body.items)).toEqual(
      ['A1', 'A2', 'AFILED', 'ALATE', 'ANA'].sort(),
    );
    expect(keys((await search('manager')).body.items)).toEqual(
      ['A1', 'A2', 'AFILED', 'ALATE', 'ANA'].sort(),
    );
    expect((await search('director')).body.total).toBe(6);
  });

  it('danh sách có người phụ trách KH; lọc theo người phụ trách', async () => {
    const { body } = await as('director')
      .get(`/customer-obligations?ownerId=${ctx.users.staff2.id}`)
      .expect(200);
    expect(keys(body.items)).toEqual(['B1']);
    expect(body.items[0].customer).toMatchObject({
      id: ids.B,
      owner: { id: ctx.users.staff2.id, fullName: 'Test staff2' },
    });
    await as('director').get('/customer-obligations?ownerId=abc').expect(400);
  });

  it('ô đếm: chưa đến hạn / đang chuẩn bị / trễ hạn / đã nộp trong tháng theo phạm vi và bộ lọc', async () => {
    const summary = async (who: keyof TestContext['users'], q = '') =>
      (await as(who).get(`/customer-obligations/summary${q}`).expect(200)).body;
    expect(await summary('director')).toEqual({
      notDue: 2,
      preparing: 1,
      overdue: 1,
      filedThisMonth: 1,
    });
    expect(await summary('staff2')).toEqual({
      notDue: 1,
      preparing: 0,
      overdue: 0,
      filedThisMonth: 0,
    });
    expect(await summary('director', `?customerId=${ids.A}`)).toEqual({
      notDue: 1,
      preparing: 1,
      overdue: 1,
      filedThisMonth: 1,
    });
    expect(
      await summary('director', `?search=${encodeURIComponent('Bảng B')}`),
    ).toMatchObject({ notDue: 1, overdue: 0 });
    await as('cashier').get('/customer-obligations/summary').expect(403);
    await as('admin').get('/customer-obligations/summary').expect(403);
  });

  it('nhắc lịch báo cáo không có việc gắn trỏ tới màn hình Lịch báo cáo', async () => {
    // 08:00 giờ VN ngày 19/02/2027: B1 (hạn 20/02) ở mốc −1 ngày.
    await ctx.app
      .get(ReminderService)
      .runOnce(new Date('2027-02-19T01:00:00Z'));
    const n = await ctx.prisma.notification.findFirst({
      where: { subjectId: ids.B1 },
    });
    expect(n).toMatchObject({
      userId: ctx.users.staff2.id,
      link: `/deadlines?id=${ids.B1}`,
    });
  });
});
