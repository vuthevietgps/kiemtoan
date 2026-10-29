/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

/** 06-D4: chuông thông báo — lọc chưa đọc, trả loại/mức độ, chỉ thông báo của mình. */
describe('06-D4 chuông thông báo (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await ctx.prisma.notification.createMany({
      data: [
        {
          userId: ctx.users.staff.id,
          title: 'Đã đọc',
          readAt: new Date(),
          createdAt: new Date('2027-01-01T01:00:00Z'),
        },
        {
          userId: ctx.users.staff.id,
          title: 'Quá hạn: Tờ khai',
          kind: 'OVERDUE',
          severity: 'DANGER',
          createdAt: new Date('2027-01-02T01:00:00Z'),
        },
        { userId: ctx.users.staff2.id, title: 'Của người khác' },
      ],
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('?unread=true chỉ trả thông báo chưa đọc của mình, kèm loại và mức độ; số chưa đọc không đổi', async () => {
    const all = await ctx
      .api(ctx.users.staff)
      .get('/notifications')
      .expect(200);
    expect(all.body.items.map((n: { title: string }) => n.title)).toEqual([
      'Quá hạn: Tờ khai',
      'Đã đọc',
    ]);
    const unread = await ctx
      .api(ctx.users.staff)
      .get('/notifications?unread=true')
      .expect(200);
    expect(unread.body.unreadCount).toBe(1);
    expect(unread.body.items).toHaveLength(1);
    expect(unread.body.items[0]).toMatchObject({
      title: 'Quá hạn: Tờ khai',
      kind: 'OVERDUE',
      severity: 'DANGER',
      readAt: null,
    });
    const notFiltered = await ctx
      .api(ctx.users.staff)
      .get('/notifications?unread=false')
      .expect(200);
    expect(notFiltered.body.items).toHaveLength(2);
    await ctx.api(ctx.users.staff).get('/notifications?unread=abc').expect(400);
  });

  it('mọi vai trò có notifications:view chỉ thấy thông báo của chính mình', async () => {
    for (const who of ['cashier', 'admin'] as const) {
      const res = await ctx
        .api(ctx.users[who])
        .get('/notifications?unread=true')
        .expect(200);
      expect(res.body.items).toEqual([]);
    }
  });
});
