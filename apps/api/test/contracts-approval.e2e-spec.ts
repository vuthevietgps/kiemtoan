/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

/** Chờ điều kiện bất đồng bộ (sinh việc chạy qua sự kiện sau khi duyệt). */
async function waitFor<T>(read: () => Promise<T>, done: (v: T) => boolean) {
  for (let i = 0; i < 40; i++) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((r) => setTimeout(r, 50));
  }
  return read();
}

describe('Contract approval and task generation status (e2e)', () => {
  let ctx: TestContext;
  let withWorkflow: string;
  let withoutWorkflow: string;
  let customerId: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const createContract = async (serviceTypeIds: string[]) => {
    const res = await as('manager')
      .post('/contracts')
      .send({
        customerId,
        startDate: '2026-11-02',
        vatRate: 10,
        services: serviceTypeIds.map((serviceTypeId) => ({
          serviceTypeId,
          period: '2026-11',
          quantity: 1,
          unitPrice: '1000000',
        })),
      })
      .expect(201);
    return res.body.id as string;
  };
  const lines = (contractId: string) =>
    ctx.prisma.contractService.findMany({
      where: { contractId },
      orderBy: { serviceType: { code: 'asc' } },
      include: { _count: { select: { tasks: true } } },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    const ktt = await ctx.prisma.serviceType.create({
      data: {
        code: 'KTT',
        name: 'Kế toán thuế',
        workflowTemplates: {
          create: {
            code: 'QT-KTT-001',
            name: 'Quy trình KTT',
            isDefault: true,
            versions: {
              create: {
                versionNo: 1,
                status: 'PUBLISHED',
                steps: {
                  create: [
                    {
                      stepKey: 'B01',
                      sortOrder: 1,
                      name: 'Nhận chứng từ',
                      dueOffsetDays: 5,
                    },
                    {
                      stepKey: 'B02',
                      sortOrder: 2,
                      name: 'Nộp tờ khai',
                      dueOffsetDays: 20,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    });
    const ht = await ctx.prisma.serviceType.create({
      data: { code: 'XHT', name: 'Dịch vụ chưa có quy trình' },
    });
    withWorkflow = ktt.id;
    withoutWorkflow = ht.id;
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty A',
          taxCode: '0100000901',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('không duyệt thẳng từ Nháp; gửi duyệt rồi duyệt đồng thời chỉ thành công một lần', async () => {
    const id = await createContract([withWorkflow]);
    await as('director').post(`/contracts/${id}/approve`).expect(400);
    await as('manager').post(`/contracts/${id}/submit`).expect(200);
    const results = await Promise.all(
      [1, 2].map(() => as('director').post(`/contracts/${id}/approve`)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const logs = await ctx.prisma.auditLog.count({
      where: { action: 'APPROVE', entityId: id },
    });
    expect(logs).toBe(1);
    // E1 (04-B): duyệt xong chưa sinh việc khi kế hoạch chưa xác nhận; xác nhận thì sinh.
    const [waiting] = await waitFor(
      () => lines(id),
      (ls) => ls[0].taskGenerationMessage !== null,
    );
    expect(waiting).toMatchObject({
      taskGenerationStatus: 'PENDING',
      taskGenerationMessage: 'Chờ xác nhận kế hoạch thực hiện',
      _count: { tasks: 0 },
    });
    const plan = await as('manager')
      .post(`/contracts/${id}/services/${waiting.id}/plan`)
      .send({})
      .expect(201);
    await as('manager')
      .post(`/contract-plans/${plan.body.id}/confirm`)
      .expect(200);
    const [line] = await lines(id);
    expect(line).toMatchObject({
      taskGenerationStatus: 'DONE',
      _count: { tasks: 2 },
    });
  });

  it('trả lại có lý do về Nháp; chỉ người có quyền duyệt được trả lại', async () => {
    const id = await createContract([withWorkflow]);
    await as('manager').post(`/contracts/${id}/submit`).expect(200);
    await as('manager')
      .post(`/contracts/${id}/return`)
      .send({ reason: 'Sai đơn giá' })
      .expect(403);
    await as('director')
      .post(`/contracts/${id}/return`)
      .send({ reason: 'abc' })
      .expect(400);
    const res = await as('director')
      .post(`/contracts/${id}/return`)
      .send({ reason: '  Sai đơn giá dòng 1  ' })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'DRAFT',
      returnedReason: 'Sai đơn giá dòng 1',
    });
    const detail = await as('manager').get(`/contracts/${id}`).expect(200);
    expect(detail.body.returnedReason).toBe('Sai đơn giá dòng 1');
    await as('director')
      .post(`/contracts/${id}/return`)
      .send({ reason: 'Trả lại lần nữa' })
      .expect(400);
  });

  it('gửi duyệt bị chặn khi dịch vụ đã ngừng cung cấp', async () => {
    const service = await ctx.prisma.serviceType.create({
      data: { code: 'OLD', name: 'Dịch vụ cũ' },
    });
    const id = await createContract([service.id]);
    await ctx.prisma.serviceType.update({
      where: { id: service.id },
      data: { isActive: false },
    });
    const res = await as('manager').post(`/contracts/${id}/submit`).expect(400);
    expect(res.body.message).toMatch(/OLD đã ngừng cung cấp/);
  });

  it('dòng chưa có quy trình không lập được kế hoạch; phát hành quy trình rồi lập, xác nhận thì sinh, sinh lại không trùng', async () => {
    const id = await createContract([withWorkflow, withoutWorkflow]);
    await as('manager').post(`/contracts/${id}/submit`).expect(200);
    await as('director').post(`/contracts/${id}/approve`).expect(200);
    const [ktt, xht] = await waitFor(
      () => lines(id),
      (ls) => ls.every((l) => l.taskGenerationMessage !== null),
    );
    const planKtt = await as('manager')
      .post(`/contracts/${id}/services/${ktt.id}/plan`)
      .send({})
      .expect(201);
    await as('manager')
      .post(`/contract-plans/${planKtt.body.id}/confirm`)
      .expect(200);
    const noWorkflow = await as('manager')
      .post(`/contracts/${id}/services/${xht.id}/plan`)
      .send({})
      .expect(400);
    expect(noWorkflow.body.message).toMatch(/chưa có quy trình đang hiệu lực/);
    const detail = await as('staff').get(`/contracts/${id}`).expect(200);
    expect(
      detail.body.services
        .map((s: { taskGenerationStatus: string }) => s.taskGenerationStatus)
        .sort(),
    ).toEqual(['DONE', 'PENDING']);
    // Còn dòng chưa sinh nhưng chưa xác nhận kế hoạch: không có gì để sinh lại.
    await as('manager').post(`/contracts/${id}/generate-tasks`).expect(409);
    await as('staff').post(`/contracts/${id}/generate-tasks`).expect(403);

    await ctx.prisma.workflowTemplate.create({
      data: {
        code: 'QT-XHT-001',
        serviceTypeId: withoutWorkflow,
        name: 'Quy trình mới',
        isDefault: true,
        versions: {
          create: {
            versionNo: 1,
            status: 'PUBLISHED',
            steps: {
              create: [
                {
                  stepKey: 'B01',
                  sortOrder: 1,
                  name: 'Làm hồ sơ',
                  dueOffsetDays: 10,
                },
              ],
            },
          },
        },
      },
    });
    const planXht = await as('manager')
      .post(`/contracts/${id}/services/${xht.id}/plan`)
      .send({})
      .expect(201);
    const results = await Promise.all(
      [1, 2].map(() =>
        as('manager').post(`/contract-plans/${planXht.body.id}/confirm`),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const after = await lines(id);
    expect(after.map((l) => [l.taskGenerationStatus, l._count.tasks])).toEqual([
      ['DONE', 2],
      ['DONE', 1],
    ]);
    await as('manager').post(`/contracts/${id}/generate-tasks`).expect(409);
  });

  it('dòng lỗi sinh việc được sinh lại sau khi khắc phục, không trùng khi gọi đồng thời', async () => {
    const id = await createContract([withWorkflow]);
    await as('manager').post(`/contracts/${id}/submit`).expect(200);
    const [line] = await lines(id);
    const plan = await as('manager')
      .post(`/contracts/${id}/services/${line.id}/plan`)
      .send({})
      .expect(201);
    await as('manager')
      .post(`/contract-plans/${plan.body.id}/confirm`)
      .expect(200);
    // Giả lập lần sinh trước bị lỗi.
    await ctx.prisma.contractService.update({
      where: { id: line.id },
      data: {
        taskGenerationStatus: 'FAILED',
        taskGenerationMessage: 'Lỗi khi sinh việc: thử',
      },
    });
    await ctx.prisma.contract.update({
      where: { id },
      data: { status: 'NOT_STARTED' },
    });
    const results = await Promise.all(
      [1, 2].map(() => as('manager').post(`/contracts/${id}/generate-tasks`)),
    );
    expect(results.map((r) => r.status)).toContain(200);
    const [after] = await lines(id);
    expect(after).toMatchObject({
      taskGenerationStatus: 'DONE',
      _count: { tasks: 2 },
    });
  });

  it('không sinh việc cho HĐ chưa duyệt', async () => {
    const id = await createContract([withWorkflow]);
    await as('manager').post(`/contracts/${id}/generate-tasks`).expect(400);
  });
});
