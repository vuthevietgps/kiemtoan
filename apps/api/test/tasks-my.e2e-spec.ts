/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { TaskStatus } from '@prisma/client';
import { createTestContext, TestContext } from './utils/test-app';

const DAY = 86_400_000;
const day = (offset: number) => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + offset * DAY,
  );
};

/** 05-E: việc của tôi 4 tab, hàng đợi soát xét + SLA, giao lại hàng loạt, bình luận, bộ lọc mới. */
describe('05-E việc của tôi, hàng đợi, giao lại, bình luận (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const id = (who: keyof TestContext['users']) => ctx.users[who].id;
  const task = (title: string, dueOffset: number, extra: object = {}) =>
    ctx.prisma.task.create({
      data: {
        customerId,
        title,
        dueDate: day(dueOffset),
        originalDueDate: day(dueOffset),
        assigneeId: id('staff'),
        requiresEvidence: false,
        ...extra,
      },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Việc Của Tôi',
          taxCode: '0100000333',
          ownerId: id('staff'),
        },
      })
    ).id;
    await task('Hạn hôm nay', 0);
    await task('Hạn 3 ngày nữa', 3, { priority: 'URGENT', isStatutory: true });
    await task('Hạn 20 ngày nữa', 20);
    await task('Quá hạn', -2);
    await task('Đã xong', -5, {
      status: TaskStatus.COMPLETED,
      completedAt: new Date(),
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('4 tab: Hôm nay / Sắp đến hạn (≤ 7 ngày) / Quá hạn / Đã hoàn thành, kèm số đếm', async () => {
    const titles = async (tab: string) => {
      const res = await as('staff').get(`/tasks/my?tab=${tab}`).expect(200);
      return {
        titles: res.body.items.map((t: { title: string }) => t.title),
        counts: res.body.counts,
      };
    };
    const today = await titles('today');
    expect(today.titles).toEqual(['Hạn hôm nay']);
    expect(today.counts).toEqual({
      today: 1,
      upcoming: 1,
      overdue: 1,
      done: 1,
    });
    expect((await titles('upcoming')).titles).toEqual(['Hạn 3 ngày nữa']);
    expect((await titles('overdue')).titles).toEqual(['Quá hạn']);
    expect((await titles('done')).titles).toEqual(['Đã xong']);
    await as('staff').get('/tasks/my?tab=bad').expect(400);
    // Việc của người khác không vào "của tôi".
    const mgr = await as('manager').get('/tasks/my?tab=today').expect(200);
    expect(mgr.body.total).toBe(0);
  });

  it('bộ lọc mới: ưu tiên, hạn pháp lý, người kiểm tra/phê duyệt', async () => {
    const urgent = await as('manager')
      .get('/tasks?priority=URGENT')
      .expect(200);
    expect(urgent.body.items.map((t: { title: string }) => t.title)).toEqual([
      'Hạn 3 ngày nữa',
    ]);
    const legal = await as('manager').get('/tasks?statutory=true').expect(200);
    expect(legal.body.total).toBe(1);
    await task('Có người kiểm tra', 10, {
      reviewLevels: 2,
      reviewerId: id('manager'),
      approverId: id('director'),
    });
    const byApprover = await as('director')
      .get(`/tasks?reviewerId=${id('director')}`)
      .expect(200);
    expect(
      byApprover.body.items.map((t: { title: string }) => t.title),
    ).toEqual(['Có người kiểm tra']);
  });

  it('hàng đợi soát xét: thời gian đã chờ (ngày làm việc), quá SLA 2 ngày; tóm tắt có số chờ', async () => {
    const t = await task('Chờ duyệt lâu', 30, {
      status: TaskStatus.IN_REVIEW,
      reviewLevels: 1,
      reviewLevel: 1,
      reviewerId: id('manager'),
    });
    // Vào cấp cách đây 10 ngày lịch → chắc chắn > 2 ngày làm việc.
    await ctx.prisma.taskStatusEvent.create({
      data: {
        taskId: t.id,
        fromStatus: TaskStatus.IN_PROGRESS,
        toStatus: TaskStatus.IN_REVIEW,
        occurredAt: new Date(Date.now() - 10 * DAY),
      },
    });
    const queue = await as('manager').get('/tasks/review-queue').expect(200);
    const row = queue.body.find((r: { id: string }) => r.id === t.id);
    expect(row.overSla).toBe(true);
    expect(row.waitingDays).toBeGreaterThan(2);
    const summary = await as('manager').get('/tasks/summary').expect(200);
    expect(summary.body).toMatchObject({
      awaitingMyReview: 1,
      inReview: 1,
      waitingClient: 0,
    });
  });

  it('giao lại hàng loạt: chỉ người quản lý việc; bỏ qua việc đã xong, báo người mới', async () => {
    const open = await ctx.prisma.task.findMany({
      where: { customerId, title: { in: ['Hạn hôm nay', 'Đã xong'] } },
    });
    const ids = open.map((t) => t.id);
    await as('staff')
      .post('/tasks/reassign')
      .send({ taskIds: ids, assigneeId: id('staff2') })
      .expect(200)
      .then((res) => expect(res.body.updated).toEqual([]));
    const res = await as('manager')
      .post('/tasks/reassign')
      .send({ taskIds: ids, assigneeId: id('manager') })
      .expect(200);
    expect(res.body.updated).toHaveLength(1);
    expect(res.body.skipped).toEqual([
      {
        id: open.find((t) => t.title === 'Đã xong')!.id,
        reason: 'Việc đã hoàn thành',
      },
    ]);
    await as('manager')
      .post('/tasks/reassign')
      .send({ taskIds: [], assigneeId: id('manager') })
      .expect(400);
    // Người thao tác không tự nhận thông báo; giao cho người khác thì người đó nhận.
    const other = open.find((t) => t.title === 'Hạn hôm nay')!;
    await as('manager')
      .post('/tasks/reassign')
      .send({ taskIds: [other.id], assigneeId: id('staff') })
      .expect(200);
    expect(
      await ctx.prisma.notification.count({
        where: { userId: id('staff'), title: { contains: 'Hạn hôm nay' } },
      }),
    ).toBe(1);
  });

  it('bình luận: ai xem được việc thì bình luận; báo người làm; ngoài phạm vi 404', async () => {
    const t = await ctx.prisma.task.findFirstOrThrow({
      where: { customerId, title: 'Hạn 20 ngày nữa' },
    });
    await as('manager')
      .post(`/tasks/${t.id}/comments`)
      .send({ content: '   ' })
      .expect(400);
    const res = await as('manager')
      .post(`/tasks/${t.id}/comments`)
      .send({ content: 'Nhớ đối chiếu sổ phụ' })
      .expect(201);
    expect(res.body).toMatchObject({
      content: 'Nhớ đối chiếu sổ phụ',
      author: { id: id('manager') },
    });
    await as('staff')
      .post(`/tasks/${t.id}/comments`)
      .send({ content: 'Đã nhận' })
      .expect(201);
    const detail = await as('staff').get(`/tasks/${t.id}`).expect(200);
    expect(
      detail.body.comments.map((c: { content: string }) => c.content),
    ).toEqual(['Đã nhận', 'Nhớ đối chiếu sổ phụ']);
    expect(
      await ctx.prisma.notification.count({
        where: { userId: id('staff'), title: { contains: 'bình luận' } },
      }),
    ).toBe(1);
    await as('staff2')
      .post(`/tasks/${t.id}/comments`)
      .send({ content: 'x' })
      .expect(404);
  });
});
