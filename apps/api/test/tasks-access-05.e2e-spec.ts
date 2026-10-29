import { Role } from '@prisma/client';
import { createTestContext, TestContext } from './utils/test-app';

const ZERO = '00000000-0000-4000-8000-000000000000';

/**
 * Tiêu chí 12 của đặc tả 05: phân quyền 5 vai trò + vai trò tùy chỉnh cho các API mới (05-B → 05-E).
 * Thu ngân và quản trị không có quyền công việc (403); thu quyền `tasks:update` qua vai trò tùy chỉnh
 * thì mọi thao tác ghi bị chặn ngay.
 */
describe('05 phân quyền các API mới (e2e)', () => {
  let ctx: TestContext;
  let taskId: string;
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);

  const READS = [
    '/tasks/my',
    '/tasks/review-queue',
    '/customer-document-requests',
    `/customer-document-requests/${ZERO}`,
  ];
  const writes = (id: string): [string, object][] => [
    [`/tasks/${id}/start`, {}],
    [`/tasks/${id}/submit`, {}],
    [`/tasks/${id}/review`, { decision: 'ACCEPT' }],
    [`/tasks/${id}/deliver`, { note: 'Đã nộp tờ khai' }],
    [`/tasks/${id}/wait-client`, { requestName: 'Sao kê' }],
    [`/tasks/${id}/resume`, {}],
    [`/tasks/${id}/hold`, { reason: 'Tạm ngưng theo khách' }],
    [`/tasks/${id}/unhold`, {}],
    [`/tasks/${id}/reopen`, { reason: 'Khách báo sai số' }],
    [
      `/tasks/${id}/due-changes`,
      { newDue: '2027-01-31', reason: 'Khách chậm gửi' },
    ],
    [`/tasks/${id}/due-changes/${ZERO}/decide`, { approve: true }],
    [`/tasks/${id}/client-waits/${ZERO}/confirm`, {}],
    ['/tasks/reassign', { taskIds: [id], assigneeId: ZERO }],
    [`/customer-document-requests/${ZERO}/request`, {}],
    [`/customer-document-requests/${ZERO}/review`, {}],
    [
      `/customer-document-requests/${ZERO}/supplement`,
      { note: 'Thiếu trang 2' },
    ],
    [`/customer-document-requests/${ZERO}/accept`, {}],
  ];

  beforeAll(async () => {
    ctx = await createTestContext();
    const customer = await ctx.prisma.customer.create({
      data: {
        name: 'Công ty Quyền 05',
        taxCode: '0100000222',
        ownerId: ctx.users.staff.id,
      },
    });
    taskId = (
      await ctx.prisma.task.create({
        data: {
          customerId: customer.id,
          title: 'Việc kiểm tra quyền',
          dueDate: new Date('2026-12-31'),
          originalDueDate: new Date('2026-12-31'),
          assigneeId: ctx.users.staff.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.prisma.user.update({
      where: { id: ctx.users.staff.id },
      data: { accessRoleId: null },
    });
    await ctx.app.close();
  });

  it.each(['cashier', 'admin'] as const)(
    '%s: 403 với mọi API xem/ghi công việc mới',
    async (who) => {
      for (const path of READS) await as(who).get(path).expect(403);
      for (const [path, body] of [
        ...writes(taskId),
        [`/tasks/${taskId}/comments`, { content: 'x' }] as [string, object],
      ])
        await as(who).post(path).send(body).expect(403);
    },
  );

  it('nhân viên bị thu tasks:update qua vai trò tùy chỉnh: xem được, mọi thao tác ghi 403', async () => {
    const role = await ctx.prisma.accessRole.create({
      data: {
        name: `Chỉ xem việc ${Date.now()}`,
        baseRole: Role.STAFF,
        scope: 'OWN',
        permissions: ['tasks:view'],
        createdById: ctx.users.director.id,
      },
    });
    await ctx.prisma.user.update({
      where: { id: ctx.users.staff.id },
      data: { accessRoleId: role.id },
    });
    await as('staff').get('/tasks/my').expect(200);
    await as('staff').get('/customer-document-requests').expect(200);
    for (const [path, body] of writes(taskId))
      await as('staff').post(path).send(body).expect(403);
    // Bình luận chỉ cần quyền xem việc.
    await as('staff')
      .post(`/tasks/${taskId}/comments`)
      .send({ content: 'Đã xem' })
      .expect(201);
  });
});
