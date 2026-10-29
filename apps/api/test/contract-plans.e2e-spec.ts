/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

interface PlanStep {
  stepKey: string;
  skipped: boolean;
  assigneeId: string | null;
  plannedStart: string | null;
  dueDate: string;
}
const day = (v: string | null) => v && v.slice(0, 10);

describe('Contract execution plans (e2e)', () => {
  let ctx: TestContext;
  let serviceId: string;
  let altVersionId: string;
  let defaultAssignee: string;
  let customerId: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const newContract = async () => {
    const res = await as('manager')
      .post('/contracts')
      .send({
        customerId,
        startDate: '2026-11-02',
        vatRate: 10,
        services: [
          {
            serviceTypeId: serviceId,
            quantity: 1,
            unitPrice: '1000000',
            assigneeId: ctx.users.staff.id,
          },
        ],
      })
      .expect(201);
    const line = await ctx.prisma.contractService.findFirstOrThrow({
      where: { contractId: res.body.id },
    });
    return { id: res.body.id as string, lineId: line.id };
  };
  const stepsOf = (body: { steps: PlanStep[] }) =>
    new Map(body.steps.map((s) => [s.stepKey, s]));

  beforeAll(async () => {
    ctx = await createTestContext();
    defaultAssignee = ctx.users.manager.id;
    const service = await ctx.prisma.serviceType.create({
      data: { code: 'LLSS', name: 'Làm lại sổ sách', cycle: 'ONE_TIME' },
    });
    serviceId = service.id;
    const projectSteps = (prefix: string) => [
      {
        stepKey: 'B01',
        sortOrder: 1,
        name: `${prefix} Tiếp nhận`,
        durationDays: 2,
        defaultAssigneeId: defaultAssignee,
      },
      {
        stepKey: 'B02',
        sortOrder: 2,
        name: `${prefix} Kiểm tra`,
        durationDays: 3,
        required: false,
      },
      {
        stepKey: 'B03',
        sortOrder: 3,
        name: `${prefix} Bàn giao`,
        durationDays: 1,
      },
    ];
    const main = await ctx.prisma.workflowTemplate.create({
      data: {
        code: 'QT-LLSS-001',
        serviceTypeId: serviceId,
        name: 'Chính',
        isDefault: true,
        versions: {
          create: {
            versionNo: 1,
            status: 'PUBLISHED',
            scheduleMode: 'PROJECT',
            steps: { create: projectSteps('v1') },
            requirements: { create: [{ sortOrder: 1, name: 'Sổ sách cũ' }] },
          },
        },
      },
      include: { versions: { include: { steps: true } } },
    });
    const steps = new Map(main.versions[0].steps.map((s) => [s.stepKey, s.id]));
    await ctx.prisma.workflowStepDependency.createMany({
      data: [
        { stepId: steps.get('B02')!, dependsOnStepId: steps.get('B01')! },
        { stepId: steps.get('B03')!, dependsOnStepId: steps.get('B02')! },
      ],
    });
    const alt = await ctx.prisma.workflowTemplate.create({
      data: {
        code: 'QT-LLSS-002',
        serviceTypeId: serviceId,
        name: 'Rút gọn',
        versions: {
          create: {
            versionNo: 1,
            status: 'PUBLISHED',
            scheduleMode: 'PROJECT',
            steps: {
              create: [
                {
                  stepKey: 'B01',
                  sortOrder: 1,
                  name: 'Làm nhanh',
                  durationDays: 1,
                },
              ],
            },
          },
        },
      },
      include: { versions: true },
    });
    altVersionId = alt.versions[0].id;
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty ABC',
          taxCode: '0100000951',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('lập kế hoạch từ phiên bản mặc định, gợi ý người và chụp hồ sơ yêu cầu; quyền theo E2', async () => {
    const c = await newContract();
    await as('staff')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({})
      .expect(403);
    await as('cashier')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({})
      .expect(403);
    const res = await as('manager')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({})
      .expect(201);
    expect(res.body).toMatchObject({
      status: 'DRAFT',
      workflowCode: 'QT-LLSS-001',
      scheduleMode: 'PROJECT',
    });
    const steps = stepsOf(res.body);
    // B01 có người mặc định của bước; B02/B03 theo người phụ trách dòng dịch vụ.
    expect(steps.get('B01')!.assigneeId).toBe(defaultAssignee);
    expect(steps.get('B02')!.assigneeId).toBe(ctx.users.staff.id);
    expect(day(steps.get('B03')!.dueDate)).toBe('2026-11-09');
    expect(res.body.requirements.map((r: { name: string }) => r.name)).toEqual([
      'Sổ sách cũ',
    ]);
    const list = await as('staff').get(`/contracts/${c.id}/plans`).expect(200);
    expect(list.body.lines[0].workflowOptions).toHaveLength(2);
  });

  it('không bỏ được bước bắt buộc; bỏ bước tuỳ chọn thì bước sau nối thẳng và lịch tính lại; sửa đồng thời 409', async () => {
    const c = await newContract();
    const plan = await as('manager')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({})
      .expect(201);
    await as('manager')
      .put(`/contract-plans/${plan.body.id}`)
      .send({ revision: 1, steps: [{ stepKey: 'B01', skipped: true }] })
      .expect(400);
    const saved = await as('manager')
      .put(`/contract-plans/${plan.body.id}`)
      .send({
        revision: 1,
        steps: [
          { stepKey: 'B02', skipped: true },
          { stepKey: 'B03', assigneeId: ctx.users.staff2.id, durationDays: 2 },
        ],
      })
      .expect(200);
    const steps = stepsOf(saved.body);
    expect(steps.get('B02')!.skipped).toBe(true);
    expect(day(steps.get('B03')!.plannedStart)).toBe('2026-11-04');
    expect(day(steps.get('B03')!.dueDate)).toBe('2026-11-05');
    expect(steps.get('B03')!.assigneeId).toBe(ctx.users.staff2.id);
    await as('manager')
      .put(`/contract-plans/${plan.body.id}`)
      .send({ revision: 1, steps: [] })
      .expect(409);
  });

  it('xác nhận trước duyệt không sinh việc; duyệt thì sinh từ kế hoạch (bỏ bước tuỳ chọn, gắn plan_step_id)', async () => {
    const c = await newContract();
    const plan = await as('manager')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({})
      .expect(201);
    await as('manager')
      .put(`/contract-plans/${plan.body.id}`)
      .send({ revision: 1, steps: [{ stepKey: 'B02', skipped: true }] })
      .expect(200);
    await as('manager')
      .post(`/contract-plans/${plan.body.id}/confirm`)
      .expect(200);
    await as('manager')
      .put(`/contract-plans/${plan.body.id}`)
      .send({ revision: 2, steps: [] })
      .expect(409);
    expect(await ctx.prisma.task.count({ where: { contractId: c.id } })).toBe(
      0,
    );
    await as('manager').post(`/contracts/${c.id}/submit`).expect(200);
    await as('director').post(`/contracts/${c.id}/approve`).expect(200);
    let tasks: {
      title: string;
      planStepId: string | null;
      assigneeId: string | null;
    }[] = [];
    for (let i = 0; i < 40 && tasks.length === 0; i++) {
      tasks = await ctx.prisma.task.findMany({
        where: { contractId: c.id },
        orderBy: { dueDate: 'asc' },
      });
      if (tasks.length === 0) await new Promise((r) => setTimeout(r, 50));
    }
    expect(tasks.map((t) => t.title)).toEqual(['v1 Tiếp nhận', 'v1 Bàn giao']);
    expect(tasks.every((t) => t.planStepId)).toBe(true);
    expect(tasks[0].assigneeId).toBe(defaultAssignee);
    await as('manager')
      .post(`/contract-plans/${plan.body.id}/reopen`)
      .expect(409);
  });

  it('sửa quy trình mẫu sau khi xác nhận không đổi kế hoạch; mở lại được khi chưa sinh việc', async () => {
    const c = await newContract();
    const plan = await as('manager')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({})
      .expect(201);
    await as('manager')
      .post(`/contract-plans/${plan.body.id}/confirm`)
      .expect(200);
    await ctx.prisma.workflowStep.updateMany({
      where: { version: { template: { code: 'QT-LLSS-001' } }, stepKey: 'B01' },
      data: { name: 'Đổi tên sau xác nhận' },
    });
    const list = await as('manager')
      .get(`/contracts/${c.id}/plans`)
      .expect(200);
    expect(list.body.lines[0].plan.steps[0].name).toBe('v1 Tiếp nhận');
    const reopened = await as('manager')
      .post(`/contract-plans/${plan.body.id}/reopen`)
      .expect(200);
    expect(reopened.body.status).toBe('DRAFT');
    await ctx.prisma.workflowStep.updateMany({
      where: { version: { template: { code: 'QT-LLSS-001' } }, stepKey: 'B01' },
      data: { name: 'v1 Tiếp nhận' },
    });
  });

  it('xem trước lịch với thay đổi chưa lưu, không ghi DB; bước bắt buộc vẫn không bỏ được', async () => {
    const c = await newContract();
    const plan = await as('manager')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({})
      .expect(201);
    const changes = {
      startDate: '2026-11-09',
      steps: [{ stepKey: 'B02', skipped: true }],
    };
    await as('staff')
      .post(`/contract-plans/${plan.body.id}/preview`)
      .send(changes)
      .expect(403);
    const preview = await as('manager')
      .post(`/contract-plans/${plan.body.id}/preview`)
      .send(changes)
      .expect(200);
    const dates = new Map(
      (preview.body as PlanStep[]).map((s) => [s.stepKey, s]),
    );
    expect(dates.get('B02')!.skipped).toBe(true);
    expect(day(dates.get('B01')!.dueDate)).toBe('2026-11-10');
    expect(day(dates.get('B03')!.plannedStart)).toBe('2026-11-11');
    expect(day(dates.get('B03')!.dueDate)).toBe('2026-11-11');
    const stored = await ctx.prisma.contractServicePlan.findUniqueOrThrow({
      where: { id: plan.body.id },
      include: { steps: { where: { stepKey: 'B02' } } },
    });
    expect(stored.revision).toBe(1);
    expect(day(stored.startDate.toISOString())).toBe('2026-11-02');
    expect(stored.steps[0].skipped).toBe(false);
    await as('manager')
      .post(`/contract-plans/${plan.body.id}/preview`)
      .send({ steps: [{ stepKey: 'B01', skipped: true }] })
      .expect(400);
  });

  it('người mặc định của bước đã nghỉ: đề xuất người khác và cảnh báo khi còn nháp', async () => {
    const left = await ctx.prisma.user.create({
      data: {
        email: 'da-nghi@test.local',
        passwordHash: 'x',
        fullName: 'Người Đã Nghỉ',
        isActive: false,
      },
    });
    const where = {
      version: { template: { code: 'QT-LLSS-001' } },
      stepKey: 'B01',
    };
    await ctx.prisma.workflowStep.updateMany({
      where,
      data: { defaultAssigneeId: left.id },
    });
    try {
      const c = await newContract();
      const plan = await as('manager')
        .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
        .send({})
        .expect(201);
      expect(stepsOf(plan.body).get('B01')!.assigneeId).toBe(
        ctx.users.staff.id,
      );
      const draft = await as('manager')
        .get(`/contracts/${c.id}/plans`)
        .expect(200);
      const warnings = (
        draft.body.lines[0].plan.steps as (PlanStep & {
          warning: string | null;
        })[]
      ).map((s) => s.warning);
      expect(warnings[0]).toContain('Người Đã Nghỉ');
      expect(warnings.slice(1)).toEqual([null, null]);
      await as('manager')
        .post(`/contract-plans/${plan.body.id}/confirm`)
        .expect(200);
      const confirmed = await as('manager')
        .get(`/contracts/${c.id}/plans`)
        .expect(200);
      expect(confirmed.body.lines[0].plan.steps[0].warning).toBeNull();
    } finally {
      await ctx.prisma.workflowStep.updateMany({
        where,
        data: { defaultAssigneeId: defaultAssignee },
      });
    }
  });

  it('chọn quy trình khác cùng dịch vụ; phiên bản không thuộc dịch vụ bị từ chối; HĐ đã huỷ không lập kế hoạch', async () => {
    const c = await newContract();
    const alt = await as('manager')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({ workflowVersionId: altVersionId, startDate: '2026-12-01' })
      .expect(201);
    expect(alt.body).toMatchObject({ workflowCode: 'QT-LLSS-002' });
    expect(alt.body.steps).toHaveLength(1);
    const other = await ctx.prisma.serviceType.create({
      data: {
        code: 'KHAC',
        name: 'Khác',
        workflowTemplates: {
          create: {
            code: 'QT-KHAC-001',
            name: 'Khác',
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
                      name: 'X',
                      dueOffsetDays: 1,
                    },
                  ],
                },
              },
            },
          },
        },
      },
      include: { workflowTemplates: { include: { versions: true } } },
    });
    await as('manager')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({ workflowVersionId: other.workflowTemplates[0].versions[0].id })
      .expect(400);
    await as('manager')
      .post(`/contracts/${c.id}/status`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    await as('manager')
      .post(`/contracts/${c.id}/services/${c.lineId}/plan`)
      .send({})
      .expect(400);
  });
});
