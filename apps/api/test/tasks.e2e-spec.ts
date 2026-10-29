/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- kiểm tra body phản hồi (supertest trả any) */
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTRACT_APPROVED,
  ContractApprovedEvent,
} from '../src/common/events/app-events';
import { confirmDefaultPlans } from './utils/plans';
import { createTestContext, TestContext } from './utils/test-app';

interface TaskRowBody {
  id: string;
  title: string;
  status: string;
  assignee: { id: string } | null;
  evidenceCount: number;
  requiresEvidence: boolean;
}

describe('Tasks (e2e)', () => {
  let ctx: TestContext;
  let contractA: string;
  let serviceA: string;
  let contractB: string;
  let customerA: string;

  /** Tạo khách hàng + HĐ (đã duyệt, chưa thực hiện) + 1 dòng dịch vụ giao cho assigneeId. */
  async function makeContract(
    code: string,
    ownerId: string,
    assigneeId: string,
    serviceTypeId: string,
  ) {
    const customer = await ctx.prisma.customer.create({
      data: { name: `Công ty ${code}`, taxCode: `TAX-${code}`, ownerId },
    });
    const contract = await ctx.prisma.contract.create({
      data: {
        code,
        customerId: customer.id,
        ownerId,
        startDate: new Date('2025-10-01'),
        status: 'NOT_STARTED',
        services: {
          create: {
            serviceTypeId,
            period: '2025-10',
            unitPrice: 1000000,
            amount: 1000000,
            assigneeId,
          },
        },
      },
      include: { services: true },
    });
    return { customer, contract };
  }

  async function approve(contractId: string) {
    // Đặc tả 04-B (E1): việc chỉ sinh từ kế hoạch đã xác nhận.
    await confirmDefaultPlans(ctx.prisma, contractId, ctx.users.director.id);
    const event: ContractApprovedEvent = {
      contractId,
      approvedById: ctx.users.director.id,
    };
    await ctx.app.get(EventEmitter2).emitAsync(CONTRACT_APPROVED, event);
  }

  async function tasksOf(contractId: string) {
    return ctx.prisma.task.findMany({
      where: { contractId },
      orderBy: { dueDate: 'asc' },
    });
  }

  beforeAll(async () => {
    ctx = await createTestContext();
    const serviceType = await ctx.prisma.serviceType.create({
      data: {
        code: 'KT-THUE',
        name: 'Kế toán thuế',
        // Đặc tả 03 D3: việc sinh từ phiên bản quy trình đang hiệu lực (cùng nội dung việc mẫu cũ).
        workflowTemplates: {
          create: {
            code: 'QT-KT-THUE-001',
            name: 'Quy trình kế toán thuế',
            isDefault: true,
            versions: {
              create: {
                versionNo: 1,
                status: 'PUBLISHED',
                scheduleMode: 'PERIODIC',
                steps: {
                  create: [
                    {
                      stepKey: 'B01',
                      sortOrder: 1,
                      name: 'Thu thập chứng từ',
                      dueOffsetDays: 5,
                      requiresEvidence: false,
                    },
                    {
                      stepKey: 'B02',
                      sortOrder: 2,
                      name: 'Nộp tờ khai GTGT',
                      dueOffsetDays: 20,
                      requiresEvidence: true,
                      // Đặc tả 05: bước 1 cấp soát xét, KTT kiểm tra; hạn pháp lý, cần giao nộp.
                      reviewLevels: 1,
                      defaultReviewerId: ctx.users.manager.id,
                      isStatutory: true,
                      requiresDelivery: true,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    });
    const a = await makeContract(
      'HD-A',
      ctx.users.manager.id,
      ctx.users.staff.id,
      serviceType.id,
    );
    const b = await makeContract(
      'HD-B',
      ctx.users.staff2.id,
      ctx.users.staff2.id,
      serviceType.id,
    );
    contractA = a.contract.id;
    serviceA = a.contract.services[0].id;
    customerA = a.customer.id;
    contractB = b.contract.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('HĐ được duyệt thì tự sinh công việc, chạy lại không sinh trùng', async () => {
    await approve(contractA);
    await approve(contractB);
    await approve(contractA);
    const tasks = await tasksOf(contractA);
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.assigneeId === ctx.users.staff.id)).toBe(true);
    expect(tasks[0].dueDate.toISOString().slice(0, 10)).toBe('2025-11-05');
    expect(tasks[1].period).toBe('2025-10');
    expect(await tasksOf(contractB)).toHaveLength(2);
  });

  it('người được giao nhận thông báo', async () => {
    const res = await ctx
      .api(ctx.users.staff)
      .get('/notifications')
      .expect(200);
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.items[0].title).toContain('Bạn được giao việc');
    expect(res.body.items[0].link).toMatch(/^\/tasks\?id=/);
  });

  it('nhân viên chỉ thấy việc của mình', async () => {
    const res = await ctx.api(ctx.users.staff).get('/tasks').expect(200);
    expect(res.body.total).toBe(2);
    const items = res.body.items as TaskRowBody[];
    expect(items.every((t) => t.assignee?.id === ctx.users.staff.id)).toBe(
      true,
    );
  });

  it('nhân viên không xem / đổi được việc người khác (404)', async () => {
    const other = (await tasksOf(contractB))[0];
    await ctx.api(ctx.users.staff).get(`/tasks/${other.id}`).expect(404);
    await ctx.api(ctx.users.staff).post(`/tasks/${other.id}/start`).expect(404);
  });

  it('API 3 trạng thái cũ trả 410 kèm hướng dẫn', async () => {
    const task = (await tasksOf(contractA))[0];
    const res = await ctx
      .api(ctx.users.staff)
      .post(`/tasks/${task.id}/status`)
      .send({ status: 'IN_PROGRESS' })
      .expect(410);
    expect(res.body.message).toContain('/submit');
    await ctx
      .api(ctx.users.manager)
      .post(`/tasks/${task.id}/approve`)
      .expect(410);
  });

  it('thu ngân không có quyền công việc (403)', async () => {
    await ctx.api(ctx.users.cashier).get('/tasks').expect(403);
    await ctx.api(ctx.users.staff).get('/tasks/workload').expect(403);
  });

  it('chặn gửi kiểm tra khi thiếu bằng chứng → tải lên → gửi được', async () => {
    const task = (await tasksOf(contractA)).find((t) => t.requiresEvidence)!;
    // Cờ và người kiểm tra đi từ bước quy trình (03) → bước kế hoạch (04) → việc.
    expect(task).toMatchObject({
      reviewLevels: 1,
      reviewerId: ctx.users.manager.id,
      isStatutory: true,
      requiresDelivery: true,
    });
    expect(task.originalDueDate).toEqual(task.dueDate);
    const api = ctx.api(ctx.users.staff);
    await api.post(`/tasks/${task.id}/start`).expect(200);
    expect(
      (await ctx.prisma.contract.findUnique({ where: { id: contractA } }))
        ?.status,
    ).toBe('IN_PROGRESS');
    const blocked = await api.post(`/tasks/${task.id}/submit`).expect(400);
    expect(blocked.body.message).toBe(
      'Vui lòng tải lên file bằng chứng trước khi gửi kiểm tra hoặc hoàn thành',
    );
    const upload = await api
      .post(`/tasks/${task.id}/evidence`)
      .field('note', 'Tờ khai đã nộp')
      .attach('file', Buffer.from('to khai'), 'to-khai.txt')
      .expect(201);
    expect(upload.body.fileName).toBe('to-khai.txt');
    const submitted = await api.post(`/tasks/${task.id}/submit`).expect(200);
    expect(submitted.body).toMatchObject({
      status: 'IN_REVIEW',
      reviewLevel: 1,
    });
    expect(submitted.body.firstSubmittedAt).toBeTruthy();

    const detail = await api.get(`/tasks/${task.id}`).expect(200);
    expect(detail.body.documents).toHaveLength(1);
    expect(detail.body.evidenceCount).toBe(1);
    expect(
      detail.body.history.some(
        (h: { action: string }) => h.action === 'SUBMIT',
      ),
    ).toBe(true);
    expect(
      detail.body.statusEvents.map((e: { toStatus: string }) => e.toStatus),
    ).toEqual(['IN_REVIEW', 'IN_PROGRESS', 'NOT_STARTED']);
  });

  it('nhân viên không tự duyệt; trả lại bắt buộc nội dung; quản lý duyệt được', async () => {
    const task = (await tasksOf(contractA)).find(
      (t) => t.status === 'IN_REVIEW',
    )!;
    await ctx
      .api(ctx.users.staff)
      .post(`/tasks/${task.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(403);
    const manager = ctx.api(ctx.users.manager);
    await manager
      .post(`/tasks/${task.id}/review`)
      .send({ decision: 'RETURN', note: 'x' })
      .expect(400);
    const returned = await manager
      .post(`/tasks/${task.id}/review`)
      .send({ decision: 'RETURN', note: 'Sai số thuế đầu vào tháng 10' })
      .expect(200);
    expect(returned.body).toMatchObject({
      status: 'CHANGES_REQUESTED',
      returnCount: 1,
    });
    const first = returned.body.firstSubmittedAt as string;
    await ctx.api(ctx.users.staff).post(`/tasks/${task.id}/submit`).expect(200);
    const res = await manager
      .post(`/tasks/${task.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(200);
    // H1: bước cần giao nộp → Đã phê duyệt, chưa hoàn thành.
    expect(res.body).toMatchObject({
      status: 'APPROVED',
      approvedById: ctx.users.manager.id,
      firstSubmittedAt: first,
      completedAt: null,
    });
    expect(res.body.acceptedAt).toBeTruthy();
    const logs = await ctx.prisma.auditLog.count({
      where: { entity: 'tasks', entityId: task.id, action: 'ACCEPT' },
    });
    expect(logs).toBe(1);
    const reviews = await ctx.prisma.taskReview.findMany({
      where: { taskId: task.id },
      orderBy: { decidedAt: 'asc' },
    });
    expect(reviews.map((r) => r.decision)).toEqual(['RETURN', 'ACCEPT']);
    // Bấm lại sau khi đã xử lý: không còn ở Chờ kiểm tra.
    await manager
      .post(`/tasks/${task.id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(400);
    // Giao nộp: file tải trước khi phê duyệt không tính là kết quả giao nộp.
    const staff = ctx.api(ctx.users.staff);
    await staff.post(`/tasks/${task.id}/deliver`).send({}).expect(400);
    const delivered = await staff
      .post(`/tasks/${task.id}/deliver`)
      .send({ note: 'Đã nộp tờ khai qua thuế điện tử' })
      .expect(200);
    expect(delivered.body).toMatchObject({
      status: 'COMPLETED',
      resultNote: 'Đã nộp tờ khai qua thuế điện tử',
    });
    expect(delivered.body.completedAt).toBeTruthy();
  });

  it('mọi việc xong → dòng dịch vụ và HĐ hoàn thành', async () => {
    const task = (await tasksOf(contractA)).find(
      (t) => t.status === 'NOT_STARTED',
    )!;
    const api = ctx.api(ctx.users.staff);
    await api.post(`/tasks/${task.id}/start`).expect(200);
    await api.post(`/tasks/${task.id}/complete`).send({}).expect(200);
    const service = await ctx.prisma.contractService.findUnique({
      where: { id: serviceA },
    });
    expect(service?.status).toBe('COMPLETED');
    const contract = await ctx.prisma.contract.findUnique({
      where: { id: contractA },
    });
    expect(contract?.status).toBe('COMPLETED');
  });

  it('quản lý thấy việc cả nhóm + khối lượng, không thấy nhóm khác', async () => {
    const api = ctx.api(ctx.users.manager);
    const list = await api.get('/tasks').expect(200);
    expect(list.body.total).toBe(2);
    const workload = await api.get('/tasks/workload').expect(200);
    expect(workload.body).toEqual([
      expect.objectContaining({ userId: ctx.users.staff.id, doneThisMonth: 2 }),
    ]);
    const byCustomer = await api.get('/tasks/by-customer').expect(200);
    expect(byCustomer.body).toEqual([
      expect.objectContaining({ customerId: customerA, done: 2, todo: 0 }),
    ]);
    const director = await ctx
      .api(ctx.users.director)
      .get('/tasks?status=OPEN')
      .expect(200);
    expect(director.body.total).toBe(2);
  });

  it('bộ lọc, tóm tắt và lịch', async () => {
    const api = ctx.api(ctx.users.staff2);
    const missing = await api.get('/tasks?missingEvidence=true').expect(200);
    expect(missing.body.total).toBe(1);
    const overdue = await api.get('/tasks?due=overdue&search=GTGT').expect(200);
    expect(overdue.body.items[0].isOverdue).toBe(true);
    const summary = await api.get('/tasks/summary?mine=true').expect(200);
    expect(summary.body).toMatchObject({
      remaining: 2,
      overdue: 2,
      missingEvidence: 1,
      byStatus: { NOT_STARTED: 2, IN_PROGRESS: 0, COMPLETED: 0 },
    });
    const cal = await api
      .get('/tasks/calendar?from=2025-11-01&to=2025-11-30')
      .expect(200);
    expect(cal.body).toHaveLength(2);
  });

  it('quản lý tạo việc phát sinh và giao lại; nhân viên không được', async () => {
    const res = await ctx
      .api(ctx.users.manager)
      .post('/tasks')
      .send({
        customerId: customerA,
        title: 'Giải trình số liệu với cơ quan thuế',
        dueDate: '2025-12-15',
        assigneeId: ctx.users.staff.id,
        requiresEvidence: false,
      })
      .expect(201);
    expect(res.body.createdById).toBe(ctx.users.manager.id);
    await ctx
      .api(ctx.users.staff)
      .post('/tasks')
      .send({ customerId: customerA, title: 'X', dueDate: '2025-12-15' })
      .expect(403);
    await ctx
      .api(ctx.users.staff)
      .patch(`/tasks/${res.body.id}`)
      .send({ assigneeId: ctx.users.manager.id })
      .expect(403);
    await ctx
      .api(ctx.users.staff)
      .patch(`/tasks/${res.body.id}`)
      .send({ note: 'Đã liên hệ kế toán khách' })
      .expect(200);
    const notes = await ctx.prisma.notification.count({
      where: { userId: ctx.users.staff.id, link: `/tasks?id=${res.body.id}` },
    });
    expect(notes).toBe(1);
  });
});
