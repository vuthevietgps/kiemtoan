/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- res.body của supertest có kiểu any */
import { todayUtc } from '../src/modules/tasks/task-filters';
import { seedOperationsData } from './utils/operations-fixtures';
import { createTestContext, TestContext } from './utils/test-app';

/**
 * 10-B tab Vận hành (M1–M3): 6 thẻ PL1 đúng định nghĩa và phạm vi từng vai; số trên thẻ = số dòng của
 * danh sách module mở ra; việc ưu tiên, tiến độ HĐ, lịch hạn 14 ngày, thông báo quan trọng; không có
 * số tiền; người không có quyền việc / lịch báo cáo nhận null; tab Tài chính cần `finance:view`.
 */
describe('10-B tổng quan vận hành (e2e)', () => {
  let ctx: TestContext;
  const ids: Record<string, string> = {};
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const today = todayUtc();
  const ops = async (who: keyof TestContext['users']) =>
    (await as(who).get('/dashboard/operations').expect(200)).body;

  beforeAll(async () => {
    ctx = await createTestContext();
    Object.assign(ids, await seedOperationsData(ctx));
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('M2: thẻ đúng định nghĩa theo phạm vi nhân viên / KTT / GĐ', async () => {
    const services = { done: 1, total: 2 };
    expect((await ops('staff')).cards).toEqual({
      activeContracts: 1,
      openTasks: 4, // mở, quá hạn, chờ duyệt, tạm dừng
      overdueTasks: 2, // quá hạn, tạm dừng quá hạn
      waitingCustomer: 2, // đã yêu cầu + cần bổ sung của KH A
      awaitingMyReview: 0,
      services,
    });
    expect((await ops('manager')).cards).toMatchObject({
      openTasks: 4,
      awaitingMyReview: 1,
    });
    expect((await ops('director')).cards).toEqual({
      activeContracts: 2,
      openTasks: 5,
      overdueTasks: 2,
      waitingCustomer: 3,
      awaitingMyReview: 0,
      services: { done: 1, total: 3 },
    });
  });

  it('M3: số trên thẻ = số dòng của danh sách module', async () => {
    const total = async (path: string) =>
      (await as('staff').get(path).expect(200)).body.total;
    const cards = (await ops('staff')).cards;
    expect(await total('/tasks?status=OPEN')).toBe(cards.openTasks);
    expect(await total('/tasks?due=overdue')).toBe(cards.overdueTasks);
    expect(await total('/contracts?status=IN_PROGRESS')).toBe(
      cards.activeContracts,
    );
    let waiting = 0;
    for (const status of ['REQUESTED', 'NEEDS_SUPPLEMENT'])
      waiting += (
        await as('staff')
          .get(`/customer-document-requests?status=${status}`)
          .expect(200)
      ).body.length;
    expect(waiting).toBe(cards.waitingCustomer);
    const queue = await as('manager').get('/tasks/review-queue').expect(200);
    expect(queue.body).toHaveLength(
      (await ops('manager')).cards.awaitingMyReview,
    );
    const done = await as('staff')
      .get('/dashboard/operations/services?state=done')
      .expect(200);
    expect(done.body).toEqual([
      expect.objectContaining({
        id: ids.serviceDone,
        completedOn: today.toISOString().slice(0, 10),
      }),
    ]);
    const open = await as('staff')
      .get('/dashboard/operations/services?state=open')
      .expect(200);
    expect(open.body.map((s: { id: string }) => s.id)).toEqual([
      ids.serviceOpen,
    ]);
  });

  it('việc ưu tiên, tiến độ HĐ, lịch hạn 14 ngày, thông báo quan trọng; không có số tiền', async () => {
    const body = await ops('staff');
    expect(body.priorityTasks.map((t: { title: string }) => t.title)).toEqual([
      'Việc quá hạn',
      'Việc mở',
      'Việc chờ duyệt',
    ]);
    expect(body.priorityTasks[0]).toMatchObject({
      daysLeft: -2,
      priority: 'HIGH',
    });
    expect(body.contractProgress).toEqual([
      expect.objectContaining({
        id: ids.ca,
        tasksDone: 1,
        tasksAll: 2,
        percent: 50,
      }),
    ]);
    expect(
      body.deadlines.map((d: { kind: string; daysLeft: number }) => [
        d.kind,
        d.daysLeft,
      ]),
    ).toEqual([
      ['TASK', 3],
      ['TASK', 5],
      ['OBLIGATION', 7],
    ]);
    expect(body.notifications.unread).toBe(1);
    expect(body.notifications.items[0]).toMatchObject({ severity: 'DANGER' });
    const json = JSON.stringify(body);
    for (const key of ['subtotal', 'amount', 'revenue', 'paid', '1000000'])
      expect(json).not.toContain(key);
  });

  it('M1: thu tiền không có quyền việc / lịch báo cáo → null; tab Tài chính chỉ người có finance:view; quản trị 403', async () => {
    const cashier = await ops('cashier');
    expect(cashier.cards).toMatchObject({
      activeContracts: 2,
      openTasks: null,
      waitingCustomer: null,
    });
    expect(cashier.priorityTasks).toBeNull();
    expect(cashier.deadlines).toEqual([]);
    await as('staff').get('/dashboard/finance').expect(403);
    await as('cashier').get('/dashboard/finance').expect(200);
    await as('manager').get('/dashboard/finance').expect(200);
    await as('admin').get('/dashboard/operations').expect(403);
  });
});
