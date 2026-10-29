/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- res.body của supertest có kiểu any */
import { ObligationStatus, Role, TaskStatus } from '@prisma/client';
import { createTestContext, TestContext } from './utils/test-app';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const MARCH = '/calendar/events?from=2027-03-01&to=2027-03-31';
// Kỳ đã qua (so với ngày chạy test thật) → chưa xong là quá hạn.
const PAST = '/calendar/events?from=2026-02-01&to=2026-02-28';

type Ids = Record<string, string>;

/** KH A (nhân viên phụ trách), KH B (nhân viên nhóm khác), 2 loại nghĩa vụ, 5 nghĩa vụ. */
async function seedObligations(ctx: TestContext, ids: Ids) {
  const customer = async (key: string, taxCode: string, ownerId: string) => {
    ids[key] = (
      await ctx.prisma.customer.create({
        data: { name: `Công ty lịch ${key}`, taxCode, ownerId },
      })
    ).id;
  };
  await customer('A', '0100006401', ctx.users.staff.id);
  await customer('B', '0100006402', ctx.users.staff2.id);
  const versions: Ids = {};
  for (const key of ['T1', 'T2']) {
    const t = await ctx.prisma.obligationType.create({
      data: {
        code: `VD-${key}`,
        name: `Tờ khai ${key}`,
        family: `VD-${key}`,
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
    ids[key] = t.id;
    versions[key] = t.versions[0].id;
  }
  const rows: [string, string, string, string, string, ObligationStatus?][] = [
    ['OA1', 'A', 'T1', '2027-02', '2027-03-20'],
    ['OA2', 'A', 'T2', '2027-02', '2027-03-25', 'FILED'],
    ['OA3', 'A', 'T2', '2027-01', '2027-03-15', 'NOT_APPLICABLE'],
    ['OB1', 'B', 'T1', '2027-02', '2027-03-20'],
    ['OLATE', 'A', 'T1', '2026-01', '2026-02-20'],
  ];
  for (const [key, customerKey, typeKey, period, due, status] of rows)
    ids[key] = (
      await ctx.prisma.customerObligation.create({
        data: {
          customerId: ids[customerKey],
          obligationTypeId: ids[typeKey],
          versionId: versions[typeKey],
          period,
          periodEnd: d(`${period}-28`),
          dueDate: d(due),
          originalDueDate: d(due),
          status,
        },
      })
    ).id;
}

/** Việc (một việc gắn nghĩa vụ OA1) và lịch năm 2027 đã xác nhận có 1 ngày nghỉ, 1 ngày làm bù. */
async function seedTasksAndCalendar(ctx: TestContext, ids: Ids) {
  const task = async (
    key: string,
    customerKey: string,
    assignee: keyof TestContext['users'],
    due: string,
    extra: { status?: TaskStatus; obligationId?: string } = {},
  ) => {
    ids[key] = (
      await ctx.prisma.task.create({
        data: {
          customerId: ids[customerKey],
          title: `Việc ${key}`,
          dueDate: d(due),
          originalDueDate: d(due),
          assigneeId: ctx.users[assignee].id,
          isStatutory: !!extra.obligationId,
          ...extra,
        },
      })
    ).id;
  };
  await task('TA1', 'A', 'staff', '2027-03-18', { obligationId: ids.OA1 });
  await task('TA2', 'A', 'manager', '2027-03-19');
  await task('TA3', 'A', 'staff', '2027-03-10', {
    status: TaskStatus.COMPLETED,
  });
  await task('TB1', 'B', 'staff2', '2027-03-20');
  await task('TLATE', 'A', 'staff', '2026-02-10', {
    status: TaskStatus.IN_PROGRESS,
  });
  await ctx.prisma.businessCalendarYear.create({
    data: {
      year: 2027,
      status: 'CONFIRMED',
      days: {
        create: [
          { date: d('2027-03-08'), kind: 'DAY_OFF', name: 'Nghỉ thử' },
          { date: d('2027-03-13'), kind: 'WORKDAY', name: 'Làm bù thử' },
        ],
      },
    },
  });
}

/**
 * 06-D tiêu chí 11: lịch gộp hạn pháp lý (lịch báo cáo) và hạn hiện hành của việc trong phạm vi
 * quyền; lọc KH/nhân viên/loại nghĩa vụ/loại hạn/trạng thái; ngày nghỉ của năm đã xác nhận.
 */
describe('06-D lịch & deadline (e2e)', () => {
  let ctx: TestContext;
  const ids: Ids = {};
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const keys = (body: { events: { id: string }[] }) =>
    body.events
      .map((e) => Object.keys(ids).find((k) => ids[k] === e.id) ?? e.id)
      .sort();

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedObligations(ctx, ids);
    await seedTasksAndCalendar(ctx, ids);
  });

  afterAll(async () => {
    await ctx.prisma.user.updateMany({
      where: { id: ctx.users.staff.id },
      data: { accessRoleId: null },
    });
    await ctx.app.close();
  });

  it('thu ngân, quản trị: 403; khoảng ngày và tham số sai: 400', async () => {
    for (const who of ['cashier', 'admin'] as const)
      await as(who).get(MARCH).expect(403);
    await as('director')
      .get('/calendar/events?from=2027-03-31&to=2027-03-01')
      .expect(400);
    await as('director')
      .get('/calendar/events?from=2027-01-01&to=2027-06-30')
      .expect(400);
    await as('director').get('/calendar/events?from=2027-03&to=x').expect(400);
    await as('director').get(`${MARCH}&kind=OTHER`).expect(400);
    await as('director').get(`${MARCH}&userId=abc`).expect(400);
  });

  it('giám đốc: gộp nghĩa vụ và việc, bỏ "Không áp dụng", kèm ngày nghỉ năm đã xác nhận', async () => {
    const { body } = await as('director').get(MARCH).expect(200);
    expect(keys(body)).toEqual(
      ['OA1', 'OA2', 'OB1', 'TA1', 'TA2', 'TA3', 'TB1'].sort(),
    );
    const dates = body.events.map((e: { date: string }) => e.date);
    expect(dates).toEqual([...dates].sort());
    const oa1 = body.events.find((e: { id: string }) => e.id === ids.OA1);
    expect(oa1).toMatchObject({
      kind: 'OBLIGATION',
      code: 'VD-T1',
      title: 'Tờ khai T1',
      date: '2027-03-20',
      status: 'NOT_DUE',
      done: false,
      overdue: false,
      urgency: 'NORMAL',
      period: '2027-02',
      customer: { id: ids.A },
      person: { id: ctx.users.staff.id },
      tasks: [{ id: ids.TA1 }],
    });
    const oa2 = body.events.find((e: { id: string }) => e.id === ids.OA2);
    expect(oa2).toMatchObject({ status: 'FILED', done: true, urgency: null });
    const ta1 = body.events.find((e: { id: string }) => e.id === ids.TA1);
    expect(ta1).toMatchObject({
      kind: 'TASK',
      date: '2027-03-18',
      status: 'NOT_STARTED',
      isStatutory: true,
      obligationId: ids.OA1,
      person: { id: ctx.users.staff.id },
    });
    expect(body.days).toEqual([
      { date: '2027-03-08', kind: 'DAY_OFF', name: 'Nghỉ thử' },
      { date: '2027-03-13', kind: 'WORKDAY', name: 'Làm bù thử' },
    ]);
    expect(body.unconfirmedYears).toEqual([]);
    expect(body.truncated).toBe(false);
    const cross = await as('director')
      .get('/calendar/events?from=2026-12-20&to=2027-01-10')
      .expect(200);
    expect(cross.body.unconfirmedYears).toEqual([2026]);
  });

  it('quá hạn: nghĩa vụ chưa nộp thành "Trễ hạn", việc chưa xong đỏ; lọc trạng thái', async () => {
    const { body } = await as('director').get(PAST).expect(200);
    expect(keys(body)).toEqual(['OLATE', 'TLATE']);
    for (const e of body.events)
      expect(e).toMatchObject({ overdue: true, urgency: 'OVERDUE' });
    expect(
      body.events.find((e: { id: string }) => e.id === ids.OLATE).status,
    ).toBe('OVERDUE');
    const overdue = await as('director').get(`${PAST}&status=OVERDUE`);
    expect(keys(overdue.body)).toEqual(['OLATE', 'TLATE']);
    const none = await as('director').get(`${MARCH}&status=OVERDUE`);
    expect(none.body.events).toEqual([]);
    const done = await as('director').get(`${MARCH}&status=DONE`);
    expect(keys(done.body)).toEqual(['OA2', 'TA3']);
    const open = await as('director').get(`${MARCH}&status=OPEN`);
    expect(keys(open.body)).toEqual(['OA1', 'OB1', 'TA1', 'TA2', 'TB1']);
  });

  it('phạm vi: nhân viên chỉ thấy KH/việc của mình; trưởng nhóm thấy nhóm', async () => {
    const staff = await as('staff').get(MARCH).expect(200);
    expect(keys(staff.body)).toEqual(['OA1', 'OA2', 'TA1', 'TA3']);
    const staff2 = await as('staff2').get(MARCH).expect(200);
    expect(keys(staff2.body)).toEqual(['OB1', 'TB1']);
    // KH ngoài phạm vi: lọc theo KH đó trả rỗng, không lộ dữ liệu.
    const outside = await as('staff2').get(`${MARCH}&customerId=${ids.A}`);
    expect(outside.body.events).toEqual([]);
    const manager = await as('manager').get(MARCH).expect(200);
    expect(keys(manager.body)).toEqual(['OA1', 'OA2', 'TA1', 'TA2', 'TA3']);
  });

  it('lọc loại hạn, KH, nhân viên, loại nghĩa vụ', async () => {
    const get = async (q: string) =>
      keys((await as('director').get(`${MARCH}&${q}`).expect(200)).body);
    expect(await get('kind=STATUTORY')).toEqual(['OA1', 'OA2', 'OB1']);
    expect(await get('kind=INTERNAL')).toEqual(['TA1', 'TA2', 'TA3', 'TB1']);
    expect(await get(`customerId=${ids.B}`)).toEqual(['OB1', 'TB1']);
    // Nghĩa vụ của nhân viên: KH do người đó phụ trách hoặc có việc gắn giao cho người đó.
    expect(await get(`userId=${ctx.users.staff.id}`)).toEqual([
      'OA1',
      'OA2',
      'TA1',
      'TA3',
    ]);
    expect(await get(`userId=${ctx.users.manager.id}`)).toEqual(['TA2']);
    expect(await get(`obligationTypeId=${ids.T1}`)).toEqual([
      'OA1',
      'OB1',
      'TA1',
    ]);
  });

  it('vai trò tùy chỉnh: chỉ tasks:view thấy việc; chỉ deadlines:view thấy nghĩa vụ; thu cả hai → 403', async () => {
    const role = await ctx.prisma.accessRole.create({
      data: {
        name: `Lịch chỉ việc ${Date.now()}`,
        baseRole: Role.STAFF,
        scope: 'OWN',
        permissions: ['tasks:view', 'customers:view'],
        createdById: ctx.users.director.id,
      },
    });
    await ctx.prisma.user.update({
      where: { id: ctx.users.staff.id },
      data: { accessRoleId: role.id },
    });
    const onlyTasks = await as('staff').get(MARCH).expect(200);
    expect(keys(onlyTasks.body)).toEqual(['TA1', 'TA3']);
    await ctx.prisma.accessRole.update({
      where: { id: role.id },
      data: { permissions: ['deadlines:view', 'customers:view'] },
    });
    const onlyObligations = await as('staff').get(MARCH).expect(200);
    expect(keys(onlyObligations.body)).toEqual(['OA1', 'OA2']);
    await ctx.prisma.accessRole.update({
      where: { id: role.id },
      data: { permissions: ['customers:view'] },
    });
    await as('staff').get(MARCH).expect(403);
  });
});
