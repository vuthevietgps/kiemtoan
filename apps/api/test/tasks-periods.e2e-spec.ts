/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTRACT_APPROVED,
  ContractApprovedEvent,
} from '../src/common/events/app-events';
import { confirmDefaultPlans } from './utils/plans';
import { createTestContext, TestContext } from './utils/test-app';

/** 05-C: sinh việc mọi kỳ (H12), khoá (bước, kỳ), phụ thuộc giữa bước (H6), tiến độ kỳ/dòng/HĐ. */
describe('05-C sinh việc nhiều kỳ và phụ thuộc (e2e)', () => {
  let ctx: TestContext;
  let contractId: string;
  let lineId: string;

  const staff = () => ctx.api(ctx.users.staff);
  const tasks = () =>
    ctx.prisma.task.findMany({
      where: { contractId },
      include: { planStep: { select: { stepKey: true } } },
      orderBy: [{ period: 'asc' }, { dueDate: 'asc' }],
    });
  const find = async (stepKey: string, period: string) =>
    (await tasks()).find(
      (t) => t.planStep?.stepKey === stepKey && t.period === period,
    )!;
  const finish = async (stepKey: string, period: string) => {
    const t = await find(stepKey, period);
    await staff().post(`/tasks/${t.id}/start`).expect(200);
    await staff().post(`/tasks/${t.id}/complete`).send({}).expect(200);
  };
  const approve = async () => {
    await confirmDefaultPlans(ctx.prisma, contractId, ctx.users.director.id);
    const event: ContractApprovedEvent = {
      contractId,
      approvedById: ctx.users.director.id,
    };
    await ctx.app.get(EventEmitter2).emitAsync(CONTRACT_APPROVED, event);
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    const serviceType = await ctx.prisma.serviceType.create({
      data: { code: 'KT-THANG', name: 'Kế toán theo tháng', cycle: 'MONTHLY' },
    });
    const template = await ctx.prisma.workflowTemplate.create({
      data: {
        serviceTypeId: serviceType.id,
        code: 'QT-KT-THANG',
        name: 'Quy trình kế toán tháng',
        isDefault: true,
      },
    });
    const version = await ctx.prisma.workflowTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNo: 1,
        status: 'PUBLISHED',
        scheduleMode: 'PERIODIC',
      },
    });
    const step = (
      stepKey: string,
      sortOrder: number,
      name: string,
      dueOffsetDays: number,
      required = true,
    ) =>
      ctx.prisma.workflowStep.create({
        data: {
          versionId: version.id,
          stepKey,
          sortOrder,
          name,
          dueOffsetDays,
          required,
          requiresEvidence: false,
        },
      });
    const b01 = await step('B01', 1, 'Thu thập chứng từ', 5);
    const b02 = await step('B02', 2, 'Nộp tờ khai', 20);
    await step('B03', 3, 'Tư vấn thêm', 25, false);
    await ctx.prisma.workflowStepDependency.create({
      data: { stepId: b02.id, dependsOnStepId: b01.id },
    });
    const customer = await ctx.prisma.customer.create({
      data: {
        name: 'Công ty Nhiều Kỳ',
        taxCode: '0100000888',
        ownerId: ctx.users.staff.id,
      },
    });
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-KY-01',
        customerId: customer.id,
        ownerId: ctx.users.manager.id,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: 'NOT_STARTED',
        services: {
          create: {
            serviceTypeId: serviceType.id,
            period: '2026-01',
            unitPrice: 1_000_000,
            amount: 3_000_000,
            assigneeId: ctx.users.staff.id,
          },
        },
      },
      include: { services: true },
    });
    contractId = contract.id;
    lineId = contract.services[0].id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('H12: sinh mọi kỳ trong thời hạn HĐ, hạn dời theo kỳ; gọi lại không sinh trùng', async () => {
    await approve();
    await approve();
    const all = await tasks();
    expect(all).toHaveLength(9);
    expect(
      all
        .filter((t) => t.planStep?.stepKey === 'B01')
        .map((t) => [t.period, t.dueDate.toISOString().slice(0, 10)]),
    ).toEqual([
      ['2026-01', '2026-02-05'],
      ['2026-02', '2026-03-05'],
      ['2026-03', '2026-04-05'],
    ]);
    expect(
      all.every((t) => t.originalDueDate.getTime() === t.dueDate.getTime()),
    ).toBe(true);
    // Chỉ báo việc kỳ đầu (3 bước), kỳ sau để nhắc hạn (06).
    expect(
      await ctx.prisma.notification.count({
        where: { userId: ctx.users.staff.id },
      }),
    ).toBe(3);
  });

  it('khoá (bước, kỳ) ở DB: không tạo được việc trùng bước và kỳ', async () => {
    const t = await find('B01', '2026-01');
    await expect(
      ctx.prisma.task.create({
        data: {
          customerId: t.customerId,
          title: 'Trùng',
          dueDate: t.dueDate,
          originalDueDate: t.dueDate,
          planStepId: t.planStepId,
          period: '2026-01',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('H6: bước sau chưa bắt đầu được khi bước trước cùng kỳ chưa xong; có nhãn chờ', async () => {
    const b02 = await find('B02', '2026-01');
    const res = await staff().post(`/tasks/${b02.id}/start`).expect(400);
    expect(res.body.message).toBe(
      'Chưa đủ điều kiện: bước trước chưa xong — Thu thập chứng từ',
    );
    const detail = await staff().get(`/tasks/${b02.id}`).expect(200);
    expect(detail.body.waitingFor).toEqual(['Thu thập chứng từ']);
    const list = await staff()
      .get(`/tasks?contractServiceId=${lineId}&period=2026-01`)
      .expect(200);
    const byTitle = Object.fromEntries(
      list.body.items.map((t: { title: string; waitingFor: string[] }) => [
        t.title,
        t.waitingFor,
      ]),
    );
    expect(byTitle).toEqual({
      'Thu thập chứng từ': [],
      'Nộp tờ khai': ['Thu thập chứng từ'],
      'Tư vấn thêm': [],
    });
  });

  it('H6: bước trước xong thì mở bước sau của đúng kỳ đó', async () => {
    await finish('B01', '2026-01');
    const b02Jan = await find('B02', '2026-01');
    await staff().post(`/tasks/${b02Jan.id}/start`).expect(200);
    const b02Feb = await find('B02', '2026-02');
    await staff().post(`/tasks/${b02Feb.id}/start`).expect(400);
  });

  it('tiến độ kỳ: kỳ hoàn tất khi mọi việc bắt buộc Hoàn thành (việc tuỳ chọn không chặn)', async () => {
    const b02Jan = await find('B02', '2026-01');
    await staff().post(`/tasks/${b02Jan.id}/complete`).send({}).expect(200);
    const plans = await staff()
      .get(`/contracts/${contractId}/plans`)
      .expect(200);
    expect(plans.body.lines[0].periods).toEqual([
      { period: '2026-01', total: 2, completed: 2, done: true },
      { period: '2026-02', total: 2, completed: 0, done: false },
      { period: '2026-03', total: 2, completed: 0, done: false },
    ]);
    const line = await ctx.prisma.contractService.findUniqueOrThrow({
      where: { id: lineId },
    });
    expect(line.status).toBe('IN_PROGRESS');
  });

  it('mọi kỳ hoàn tất → dòng dịch vụ và HĐ hoàn thành', async () => {
    for (const period of ['2026-02', '2026-03']) {
      await finish('B01', period);
      await finish('B02', period);
    }
    const line = await ctx.prisma.contractService.findUniqueOrThrow({
      where: { id: lineId },
    });
    expect(line.status).toBe('COMPLETED');
    const contract = await ctx.prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
    });
    expect(contract.status).toBe('COMPLETED');
  });
});
