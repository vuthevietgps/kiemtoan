/* eslint-disable @typescript-eslint/no-unsafe-member-access -- res.body của supertest có kiểu any */
import { Role } from '@prisma/client';
import { confirmDefaultPlans } from './utils/plans';
import { createTestContext, TestContext } from './utils/test-app';

const ZERO = '00000000-0000-4000-8000-000000000000';

/**
 * 06-B tiêu chí 12: phân quyền 5 vai trò + vai trò tùy chỉnh cho API lịch năm/loại nghĩa vụ/lịch báo
 * cáo; bước quy trình (03) chỉ gắn loại nghĩa vụ cho bước pháp lý và kế hoạch (04) chép loại nghĩa vụ.
 */
describe('06-B phân quyền và gắn loại nghĩa vụ vào quy trình (e2e)', () => {
  let ctx: TestContext;
  let typeId: string;
  let customerId: string;
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);

  beforeAll(async () => {
    ctx = await createTestContext();
    typeId = (
      await ctx.prisma.obligationType.create({
        data: {
          code: 'VD-THANG',
          name: 'Nghĩa vụ ví dụ tháng',
          family: 'VD',
          cycle: 'MONTHLY',
          versions: {
            create: {
              versionNo: 1,
              status: 'CONFIRMED',
              effectiveFrom: new Date('2026-01-01'),
              dueRule: 'MONTH_AFTER_END',
              monthsAfter: 1,
              dueDay: 20,
            },
          },
        },
      })
    ).id;
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Quyền 06',
          taxCode: '0100006100',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.prisma.user.updateMany({
      where: { id: { in: [ctx.users.staff.id, ctx.users.manager.id] } },
      data: { accessRoleId: null },
    });
    await ctx.app.close();
  });

  it('thu ngân và quản trị: 403 với lịch báo cáo và loại nghĩa vụ; xem lịch năm thì được', async () => {
    for (const who of ['cashier', 'admin'] as const) {
      await as(who).get('/business-calendar/2027').expect(200);
      await as(who).get('/obligation-types').expect(403);
      await as(who).get('/customer-obligations').expect(403);
      await as(who)
        .get(`/customers/${customerId}/obligation-settings`)
        .expect(403);
      await as(who)
        .post(`/customer-obligations/${ZERO}/prepare`)
        .send({ revision: 1 })
        .expect(403);
      await as(who)
        .put('/business-calendar/2027')
        .send({ days: [] })
        .expect(403);
      await as(who)
        .post(`/obligation-types/${typeId}/retire`)
        .send({ reason: 'Ngừng thử quyền' })
        .expect(403);
    }
  });

  it('vai trò tùy chỉnh: thu deadlines:update thì chỉ xem; KTT tùy chỉnh không có quyền xác nhận', async () => {
    const viewer = await ctx.prisma.accessRole.create({
      data: {
        name: `Chỉ xem lịch báo cáo ${Date.now()}`,
        baseRole: Role.STAFF,
        scope: 'OWN',
        permissions: ['deadlines:view', 'customers:view'],
        createdById: ctx.users.director.id,
      },
    });
    await ctx.prisma.user.update({
      where: { id: ctx.users.staff.id },
      data: { accessRoleId: viewer.id },
    });
    await as('staff').get('/customer-obligations').expect(200);
    await as('staff')
      .get(`/customers/${customerId}/obligation-settings`)
      .expect(200);
    await as('staff')
      .post(`/customer-obligations/${ZERO}/prepare`)
      .send({ revision: 1 })
      .expect(403);
    await as('staff')
      .put(`/customers/${customerId}/obligation-settings/${typeId}`)
      .send({ enabled: false, reason: 'KH tự nộp tờ khai' })
      .expect(403);
    // Cấp lại quyền: có hiệu lực ngay.
    await ctx.prisma.accessRole.update({
      where: { id: viewer.id },
      data: {
        permissions: ['deadlines:view', 'deadlines:update', 'customers:view'],
      },
    });
    await as('staff')
      .put(`/customers/${customerId}/obligation-settings/${typeId}`)
      .send({ enabled: false, reason: 'KH tự nộp tờ khai' })
      .expect(200);

    const drafter = await ctx.prisma.accessRole.create({
      data: {
        name: `Soạn lịch ${Date.now()}`,
        baseRole: Role.MANAGER,
        scope: 'TEAM',
        permissions: ['deadlines:view', 'deadlines:create'],
        createdById: ctx.users.director.id,
      },
    });
    await ctx.prisma.user.update({
      where: { id: ctx.users.manager.id },
      data: { accessRoleId: drafter.id },
    });
    await as('manager')
      .put('/business-calendar/2028')
      .send({
        days: [{ date: '2028-01-01', kind: 'DAY_OFF', name: 'Tết Dương lịch' }],
      })
      .expect(200);
    await as('manager')
      .post('/business-calendar/2028/confirm')
      .send({ revision: 1 })
      .expect(403);
    await as('manager')
      .post(`/obligation-types/${typeId}/retire`)
      .send({ reason: 'Ngừng thử quyền' })
      .expect(403);
  });

  it('03/04: chỉ bước pháp lý gắn loại nghĩa vụ đang dùng; kế hoạch chép loại nghĩa vụ', async () => {
    const service = await ctx.prisma.serviceType.create({
      data: { code: 'KTT-Q', name: 'Kế toán thuế', cycle: 'MONTHLY' },
    });
    const template = await ctx.prisma.workflowTemplate.create({
      data: {
        serviceTypeId: service.id,
        code: 'QT-KTTQ-001',
        name: 'QT',
        isDefault: true,
      },
    });
    const version = await ctx.prisma.workflowTemplateVersion.create({
      data: { templateId: template.id, versionNo: 1, scheduleMode: 'PERIODIC' },
    });
    const step = (patch: Record<string, unknown>) => ({
      key: 'B01',
      name: 'Nộp tờ khai',
      dueOffsetDays: 20,
      dependsOn: [],
      ...patch,
    });
    const save = (revision: number, patch: Record<string, unknown>) =>
      ctx
        .api(ctx.users.director)
        .put(`/workflow-versions/${version.id}`)
        .send({ revision, scheduleMode: 'PERIODIC', steps: [step(patch)] });
    const notStatutory = await save(1, { obligationTypeId: typeId }).expect(
      400,
    );
    expect(notStatutory.body.message).toContain('chỉ bước có hạn pháp lý');
    await save(1, { isStatutory: true, obligationTypeId: ZERO }).expect(400);
    const saved = await save(1, {
      isStatutory: true,
      obligationTypeId: typeId,
    }).expect(200);
    expect(saved.body.steps[0]).toMatchObject({
      isStatutory: true,
      obligationTypeId: typeId,
    });
    await ctx
      .api(ctx.users.director)
      .post(`/workflow-versions/${version.id}/publish`)
      .expect(201);
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-06-Q',
        customerId,
        ownerId: ctx.users.director.id,
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-01-31'),
        status: 'DRAFT',
        services: {
          create: {
            serviceTypeId: service.id,
            period: '2027-01',
            unitPrice: 1,
            amount: 1,
          },
        },
      },
    });
    await confirmDefaultPlans(ctx.prisma, contract.id, ctx.users.director.id);
    const planStep = await ctx.prisma.contractPlanStep.findFirstOrThrow({
      where: { plan: { contractService: { contractId: contract.id } } },
    });
    expect(planStep).toMatchObject({
      isStatutory: true,
      obligationTypeId: typeId,
    });
  });
});
