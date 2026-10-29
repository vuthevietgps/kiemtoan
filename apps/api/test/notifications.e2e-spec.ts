/* eslint-disable @typescript-eslint/no-unsafe-member-access -- kiểm tra body phản hồi (supertest trả any) */
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TASK_ASSIGNED,
  TaskAssignedEvent,
} from '../src/common/events/app-events';
import { createTestContext, TestContext } from './utils/test-app';

describe('Notifications (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    const emitter = ctx.app.get(EventEmitter2);
    for (const title of ['Việc 1', 'Việc 2']) {
      const event: TaskAssignedEvent = {
        taskId: '00000000-0000-0000-0000-000000000001',
        assigneeId: ctx.users.staff.id,
        title,
      };
      await emitter.emitAsync(TASK_ASSIGNED, event);
    }
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('sự kiện giao việc tạo thông báo cho người được giao', async () => {
    const res = await ctx
      .api(ctx.users.staff)
      .get('/notifications')
      .expect(200);
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.items[0].title).toBe('Bạn được giao việc: Việc 2');
  });

  it('chỉ thấy và đánh dấu được thông báo của mình', async () => {
    const mine = await ctx.prisma.notification.findFirstOrThrow({
      where: { userId: ctx.users.staff.id },
    });
    const other = await ctx
      .api(ctx.users.manager)
      .get('/notifications')
      .expect(200);
    expect(other.body.items).toHaveLength(0);
    await ctx
      .api(ctx.users.manager)
      .post(`/notifications/${mine.id}/read`)
      .expect(404);
    const read = await ctx
      .api(ctx.users.staff)
      .post(`/notifications/${mine.id}/read`)
      .expect(200);
    expect(read.body.readAt).toBeTruthy();
  });

  it('đánh dấu đã đọc tất cả', async () => {
    const res = await ctx
      .api(ctx.users.staff)
      .post('/notifications/read-all')
      .expect(200);
    expect(res.body.count).toBe(1);
    const after = await ctx
      .api(ctx.users.staff)
      .get('/notifications')
      .expect(200);
    expect(after.body.unreadCount).toBe(0);
  });

  it('chưa đăng nhập không xem được thông báo (401)', async () => {
    const res = await ctx
      .api({ ...ctx.users.staff, token: 'sai' })
      .get('/notifications');
    expect(res.status).toBe(401);
  });
});
