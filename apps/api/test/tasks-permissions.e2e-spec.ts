/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- kiểm tra body phản hồi (supertest trả any) */
import { Role } from '@prisma/client';
import { createTestContext, TestContext } from './utils/test-app';

/**
 * Review 22/10 — R2: quyền quản lý việc phải theo quyền hiệu lực (vai trò tùy chỉnh), không theo
 * vai trò gốc; R3: người làm không tự duyệt việc của mình. Viết trước khi sửa (đặc tả 05, 05-B).
 */
describe('Tasks — quyền hiệu lực và chống tự duyệt (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const task = (assigneeId: string, extra: object = {}) =>
    ctx.prisma.task.create({
      data: {
        customerId,
        title: 'Việc kiểm thử quyền',
        dueDate: new Date('2026-12-31'),
        originalDueDate: new Date('2026-12-31'),
        assigneeId,
        ...extra,
      },
    });
  /** Gán vai trò tùy chỉnh trực tiếp; guard đọc lại quyền từ DB ở mỗi request. */
  const giveRole = async (
    who: keyof TestContext['users'],
    baseRole: Role,
    scope: string,
    permissions: string[],
  ) => {
    const role = await ctx.prisma.accessRole.create({
      data: {
        name: `Vai trò ${who} ${Date.now()}`,
        baseRole,
        scope,
        permissions,
        createdById: ctx.users.director.id,
      },
    });
    await ctx.prisma.user.update({
      where: { id: ctx.users[who].id },
      data: { accessRoleId: role.id },
    });
  };
  const clearRole = (who: keyof TestContext['users']) =>
    ctx.prisma.user.update({
      where: { id: ctx.users[who].id },
      data: { accessRoleId: null },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Quyền Việc',
          taxCode: '0100000555',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
  });

  // Gỡ vai trò tùy chỉnh sau mỗi test, kể cả khi test thất bại giữa chừng.
  afterEach(async () => {
    await clearRole('manager');
    await clearRole('staff');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('R2: KTT bị thu quyền duyệt việc không còn được giao lại việc', async () => {
    const t = await task(ctx.users.staff.id);
    await giveRole('manager', Role.MANAGER, 'TEAM', [
      'tasks:view',
      'tasks:update',
    ]);
    await as('manager')
      .patch(`/tasks/${t.id}`)
      .send({ assigneeId: ctx.users.manager.id })
      .expect(403);
  });

  it('R2: nhân viên được cấp quyền duyệt việc qua vai trò tùy chỉnh thì giao lại được', async () => {
    const t = await task(ctx.users.staff.id);
    await giveRole('staff', Role.STAFF, 'OWN', [
      'tasks:view',
      'tasks:update',
      'tasks:approve',
    ]);
    await as('staff')
      .patch(`/tasks/${t.id}`)
      .send({ assigneeId: ctx.users.manager.id })
      .expect(200);
  });

  it('R2: thu quyền tasks:update thì không kiểm tra được dù là người được chỉ định', async () => {
    const t = await task(ctx.users.staff.id, {
      status: 'IN_REVIEW',
      reviewLevels: 1,
      reviewLevel: 1,
      reviewerId: ctx.users.manager.id,
    });
    await giveRole('manager', Role.MANAGER, 'TEAM', ['tasks:view']);
    await as('manager')
      .post(`/tasks/${t.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(403);
  });

  // Đặc tả 05 thay API /approve bằng /review; kiểm chứng R3 giữ nguyên: người có quyền duyệt
  // (người quản lý việc) vẫn không tự duyệt việc giao cho chính mình.
  it('R3: người có quyền duyệt không tự duyệt việc của chính mình', async () => {
    const t = await task(ctx.users.manager.id, {
      status: 'IN_REVIEW',
      reviewLevels: 1,
      reviewLevel: 1,
      reviewerId: ctx.users.staff.id,
    });
    await as('manager')
      .post(`/tasks/${t.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(403);
    const after = await ctx.prisma.task.findUniqueOrThrow({
      where: { id: t.id },
    });
    expect(after.status).toBe('IN_REVIEW');
  });

  it('R3/H3: một người không vừa kiểm tra vừa phê duyệt cùng một việc', async () => {
    const t = await task(ctx.users.staff.id, {
      status: 'IN_REVIEW',
      reviewLevels: 2,
      reviewLevel: 1,
      reviewerId: ctx.users.manager.id,
      approverId: ctx.users.director.id,
    });
    await as('manager')
      .post(`/tasks/${t.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(200);
    // KTT có tasks:approve (nhận thay được) nhưng đã chấp nhận cấp 1.
    await as('manager')
      .post(`/tasks/${t.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(403);
    const done = await as('director')
      .post(`/tasks/${t.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(200);
    expect(done.body.status).toBe('COMPLETED');
    const reviews = await ctx.prisma.taskReview.findMany({
      where: { taskId: t.id },
      orderBy: { level: 'asc' },
    });
    expect(reviews.map((r) => [r.level, r.reviewerId])).toEqual([
      [1, ctx.users.manager.id],
      [2, ctx.users.director.id],
    ]);
  });

  it('nhân viên phạm vi OWN thấy và kiểm tra được việc mình được chỉ định (KH trong phạm vi)', async () => {
    const t = await task(ctx.users.manager.id, {
      status: 'IN_REVIEW',
      reviewLevels: 1,
      reviewLevel: 1,
      reviewerId: ctx.users.staff.id,
    });
    await as('staff').get(`/tasks/${t.id}`).expect(200);
    const queue = await as('staff').get('/tasks/review-queue').expect(200);
    expect(queue.body.map((r: { id: string }) => r.id)).toContain(t.id);
    const res = await as('staff')
      .post(`/tasks/${t.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('F6: người kiểm tra không thấy việc của KH ngoài phạm vi (404)', async () => {
    const t = await task(ctx.users.manager.id, {
      status: 'IN_REVIEW',
      reviewLevels: 1,
      reviewLevel: 1,
      reviewerId: ctx.users.staff2.id,
    });
    await as('staff2').get(`/tasks/${t.id}`).expect(404);
    await as('staff2')
      .post(`/tasks/${t.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(404);
  });
});
