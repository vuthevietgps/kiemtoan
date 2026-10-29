/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTRACT_APPROVED,
  ContractApprovedEvent,
} from '../src/common/events/app-events';
import { confirmDefaultPlans } from './utils/plans';
import { createTestContext, TestContext } from './utils/test-app';

/**
 * 05-D: hồ sơ yêu cầu 6 trạng thái, chờ khách tự động/tay và xác nhận khoảng chờ, tạm dừng/mở lại,
 * đề nghị/duyệt gia hạn, thông báo gửi kiểm tra/trả lại.
 */
describe('05-D hồ sơ, chờ khách, gia hạn, tạm dừng (e2e)', () => {
  let ctx: TestContext;
  let contractId: string;
  let customerId: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const id = (who: keyof TestContext['users']) => ctx.users[who].id;
  const task = async (stepKey: string, period: string) =>
    ctx.prisma.task.findFirstOrThrow({
      where: { contractId, period, planStep: { stepKey } },
    });
  const requests = () =>
    ctx.prisma.customerDocumentRequest.findMany({
      where: { contractId },
      orderBy: [{ stepKey: 'asc' }, { period: 'asc' }],
    });
  const notes = (who: keyof TestContext['users'], text: string) =>
    ctx.prisma.notification.count({
      where: { userId: id(who), title: { contains: text } },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    const serviceType = await ctx.prisma.serviceType.create({
      data: { code: 'KT-HS', name: 'Kế toán có hồ sơ', cycle: 'MONTHLY' },
    });
    const template = await ctx.prisma.workflowTemplate.create({
      data: {
        serviceTypeId: serviceType.id,
        code: 'QT-KT-HS',
        name: 'Quy trình có hồ sơ',
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
    const step = (stepKey: string, sortOrder: number, name: string) =>
      ctx.prisma.workflowStep.create({
        data: {
          versionId: version.id,
          stepKey,
          sortOrder,
          name,
          dueOffsetDays: 10 * sortOrder,
          requiresEvidence: false,
        },
      });
    const b01 = await step('B01', 1, 'Hạch toán chứng từ');
    const b02 = await step('B02', 2, 'Lập báo cáo');
    await step('B03', 3, 'Tư vấn khác');
    await ctx.prisma.documentRequirement.createMany({
      data: [
        {
          versionId: version.id,
          sortOrder: 1,
          name: 'Sao kê ngân hàng',
          perPeriod: true,
          stepId: b01.id,
        },
        {
          versionId: version.id,
          sortOrder: 2,
          name: 'Giấy phép kinh doanh',
          perPeriod: false,
          stepId: b02.id,
        },
      ],
    });
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Hồ Sơ',
          taxCode: '0100000444',
          ownerId: id('staff'),
        },
      })
    ).id;
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-HS-01',
        customerId,
        ownerId: id('manager'),
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-02-28'),
        status: 'NOT_STARTED',
        services: {
          create: {
            serviceTypeId: serviceType.id,
            period: '2026-01',
            unitPrice: 1_000_000,
            amount: 2_000_000,
            assigneeId: id('staff'),
          },
        },
      },
    });
    contractId = contract.id;
    await confirmDefaultPlans(ctx.prisma, contractId, id('director'));
    const event: ContractApprovedEvent = {
      contractId,
      approvedById: id('director'),
    };
    await ctx.app.get(EventEmitter2).emitAsync(CONTRACT_APPROVED, event);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('sinh hồ sơ theo kỳ/một lần; bước còn hồ sơ bắt buộc vào Chờ khách tự động', async () => {
    expect(
      (await requests()).map((r) => [
        r.stepKey,
        r.period,
        r.perPeriod,
        r.status,
      ]),
    ).toEqual([
      ['B01', '2026-01', true, 'NOT_REQUESTED'],
      ['B01', '2026-02', true, 'NOT_REQUESTED'],
      ['B02', '2026-01', false, 'NOT_REQUESTED'],
    ]);
    for (const key of ['B01', 'B02'])
      for (const period of ['2026-01', '2026-02'])
        expect((await task(key, period)).status).toBe('WAITING_CLIENT');
    expect((await task('B03', '2026-01')).status).toBe('NOT_STARTED');
    const t = await task('B01', '2026-01');
    const resume = await as('staff')
      .post(`/tasks/${t.id}/resume`)
      .send({})
      .expect(400);
    expect(resume.body.message).toBe(
      'Còn hồ sơ bắt buộc chưa chấp nhận: Sao kê ngân hàng',
    );
    const waits = await ctx.prisma.taskClientWait.count({
      where: { taskId: t.id, endedAt: null, automatic: true },
    });
    expect(waits).toBe(1);
  });

  it('6 trạng thái hồ sơ: yêu cầu → tải thay khách → kiểm tra → cần bổ sung → … → chấp nhận mở lại việc', async () => {
    const [jan, feb] = await requests();
    const base = `/customer-document-requests/${jan.id}`;
    const list = await as('staff')
      .get(
        `/customer-document-requests?taskId=${(await task('B01', '2026-01')).id}`,
      )
      .expect(200);
    expect(list.body.map((r: { id: string }) => r.id)).toEqual([jan.id]);
    await as('staff').post(`${base}/accept`).send({}).expect(400);
    await as('staff')
      .post(`${base}/request`)
      .send({ method: 'Zalo', clientDueDate: '2026-02-03' })
      .expect(200);
    const up = await as('staff')
      .post(`${base}/upload`)
      .field('note', 'Khách gửi qua Zalo')
      .attach('file', Buffer.from('%PDF-1.4 sao ke'), 'sao-ke-t1.pdf')
      .expect(200);
    expect(up.body).toMatchObject({ status: 'UPLOADED' });
    expect(up.body.files.map((f: { fileName: string }) => f.fileName)).toEqual([
      'sao-ke-t1.pdf',
    ]);
    // Tải lên không tự hoàn tất việc (PL1 V.4).
    expect((await task('B01', '2026-01')).status).toBe('WAITING_CLIENT');
    await as('staff').post(`${base}/review`).expect(200);
    await as('staff')
      .post(`${base}/supplement`)
      .send({ note: 'x' })
      .expect(400);
    await as('staff')
      .post(`${base}/supplement`)
      .send({ note: 'Thiếu trang 2 của sao kê' })
      .expect(200);
    await as('staff').post(`${base}/request`).send({}).expect(200);
    await as('staff')
      .post(`${base}/upload`)
      .attach('file', Buffer.from('%PDF-1.4 sao ke du'), 'sao-ke-t1-du.pdf')
      .expect(200);
    // KTT chấp nhận → người làm (nhân viên) nhận thông báo; người thao tác không tự nhận.
    const done = await as('manager')
      .post(`${base}/accept`)
      .send({})
      .expect(200);
    expect(done.body.status).toBe('ACCEPTED');
    expect(
      done.body.events.map((e: { toStatus: string }) => e.toStatus),
    ).toEqual([
      'ACCEPTED',
      'UPLOADED',
      'REQUESTED',
      'NEEDS_SUPPLEMENT',
      'IN_REVIEW',
      'UPLOADED',
      'REQUESTED',
    ]);
    // Kỳ 1 đủ hồ sơ → tự về Chưa bắt đầu, báo người làm; kỳ 2 vẫn chờ.
    expect((await task('B01', '2026-01')).status).toBe('NOT_STARTED');
    expect((await task('B01', '2026-02')).status).toBe('WAITING_CLIENT');
    expect(await notes('staff', 'Đủ hồ sơ')).toBe(1);
    expect(feb.status).toBe('NOT_REQUESTED');
  });

  it('hồ sơ một lần mở mọi kỳ của bước; cần bổ sung đưa việc đang làm về Chờ khách', async () => {
    const once = (await requests()).find((r) => r.stepKey === 'B02')!;
    const base = `/customer-document-requests/${once.id}`;
    await as('staff')
      .post(`${base}/upload`)
      .attach('file', Buffer.from('%PDF-1.4 gpkd'), 'gpkd.pdf')
      .expect(200);
    await as('staff').post(`${base}/accept`).send({}).expect(200);
    expect((await task('B02', '2026-01')).status).toBe('NOT_STARTED');
    expect((await task('B02', '2026-02')).status).toBe('NOT_STARTED');
    // Bước B02 chờ B01? Không có phụ thuộc — bắt đầu được, rồi hồ sơ bị yêu cầu bổ sung.
    const b02 = await task('B02', '2026-01');
    await as('staff').post(`/tasks/${b02.id}/start`).expect(200);
    await ctx.prisma.customerDocumentRequest.update({
      where: { id: once.id },
      data: { status: 'IN_REVIEW' },
    });
    await as('manager')
      .post(`${base}/supplement`)
      .send({ note: 'GPKD hết hiệu lực, gửi bản mới' })
      .expect(200);
    const back = await task('B02', '2026-01');
    expect(back.status).toBe('WAITING_CLIENT');
    expect(await notes('staff', 'Hồ sơ cần bổ sung')).toBeGreaterThan(0);
  });

  it('chờ khách tay: phải chọn/tạo hồ sơ; người làm tự tiếp tục; trưởng nhóm/quản lý xác nhận khoảng chờ', async () => {
    const t = await task('B03', '2026-01');
    await as('staff').post(`/tasks/${t.id}/start`).expect(200);
    await as('staff').post(`/tasks/${t.id}/wait-client`).send({}).expect(400);
    await as('manager')
      .post(`/tasks/${t.id}/wait-client`)
      .send({ requestName: 'Bảng lương' })
      .expect(403);
    const waiting = await as('staff')
      .post(`/tasks/${t.id}/wait-client`)
      .send({ requestName: 'Bảng lương tháng 1', method: 'Email' })
      .expect(200);
    expect(waiting.body.status).toBe('WAITING_CLIENT');
    const created = await ctx.prisma.customerDocumentRequest.findFirstOrThrow({
      where: { taskId: t.id },
    });
    expect(created).toMatchObject({
      status: 'REQUESTED',
      requestMethod: 'Email',
    });
    const back = await as('staff')
      .post(`/tasks/${t.id}/resume`)
      .send({})
      .expect(200);
    expect(back.body.status).toBe('IN_PROGRESS');
    const detail = await as('manager').get(`/tasks/${t.id}`).expect(200);
    const wait = detail.body.clientWaits[0];
    expect(wait).toMatchObject({ automatic: false, confirmedAt: null });
    await as('staff')
      .post(`/tasks/${t.id}/client-waits/${wait.id}/confirm`)
      .expect(403);
    await as('manager')
      .post(`/tasks/${t.id}/client-waits/${wait.id}/confirm`)
      .expect(200);
    await as('manager')
      .post(`/tasks/${t.id}/client-waits/${wait.id}/confirm`)
      .expect(409);
    const open = await ctx.prisma.taskClientWait.findFirstOrThrow({
      where: { endedAt: null, task: { contractId } },
    });
    await as('manager')
      .post(`/tasks/${open.taskId}/client-waits/${open.id}/confirm`)
      .expect(400);
  });

  it('tạm dừng/tiếp tục (H5) và mở lại sau hoàn thành: chỉ người quản lý việc, bắt buộc lý do', async () => {
    const t = await task('B03', '2026-01');
    await as('staff')
      .post(`/tasks/${t.id}/hold`)
      .send({ reason: 'Khách tạm ngưng' })
      .expect(403);
    await as('manager')
      .post(`/tasks/${t.id}/hold`)
      .send({ reason: 'x' })
      .expect(400);
    const held = await as('manager')
      .post(`/tasks/${t.id}/hold`)
      .send({ reason: 'Khách tạm ngưng hoạt động' })
      .expect(200);
    expect(held.body).toMatchObject({
      status: 'ON_HOLD',
      statusBeforeHold: 'IN_PROGRESS',
    });
    await as('staff').post(`/tasks/${t.id}/complete`).send({}).expect(400);
    const resumed = await as('manager')
      .post(`/tasks/${t.id}/unhold`)
      .send({})
      .expect(200);
    expect(resumed.body).toMatchObject({
      status: 'IN_PROGRESS',
      statusBeforeHold: null,
    });
    await as('staff').post(`/tasks/${t.id}/complete`).send({}).expect(200);
    await as('manager')
      .post(`/tasks/${t.id}/reopen`)
      .send({ reason: 'x' })
      .expect(400);
    const reopened = await as('manager')
      .post(`/tasks/${t.id}/reopen`)
      .send({ reason: 'Khách báo sai số liệu' })
      .expect(200);
    expect(reopened.body).toMatchObject({
      status: 'IN_PROGRESS',
      reopenCount: 1,
      completedAt: null,
    });
    expect(reopened.body.firstSubmittedAt).toBeTruthy();
    expect(await notes('staff', 'Việc được mở lại')).toBe(1);
  });

  it('gia hạn (H7): đề nghị → duyệt; giữ hạn gốc; không tự duyệt; hạn pháp lý chỉ theo văn bản của GĐ', async () => {
    const t = await task('B03', '2026-02');
    await as('staff')
      .patch(`/tasks/${t.id}`)
      .send({ dueDate: '2026-12-31' })
      .expect(400);
    const base = `/tasks/${t.id}/due-changes`;
    await as('staff')
      .post(base)
      .send({ newDue: '2026-01-01', reason: 'Khách chậm' })
      .expect(400);
    await as('staff')
      .post(base)
      .send({ newDue: '2026-04-30', reason: 'x' })
      .expect(400);
    await as('staff')
      .post(base)
      .send({ newDue: '2026-04-30', reason: 'Khách chậm gửi chứng từ' })
      .expect(201);
    await as('staff')
      .post(base)
      .send({ newDue: '2026-05-30', reason: 'Khách chậm gửi chứng từ' })
      .expect(409);
    const change = await ctx.prisma.taskDueChange.findFirstOrThrow({
      where: { taskId: t.id },
    });
    await as('staff')
      .post(`${base}/${change.id}/decide`)
      .send({ approve: true })
      .expect(403);
    await as('manager')
      .post(`${base}/${change.id}/decide`)
      .send({ approve: true })
      .expect(200);
    await as('manager')
      .post(`${base}/${change.id}/decide`)
      .send({ approve: true })
      .expect(409);
    const after = await ctx.prisma.task.findUniqueOrThrow({
      where: { id: t.id },
    });
    expect(after.dueDate.toISOString().slice(0, 10)).toBe('2026-04-30');
    expect(after.originalDueDate.getTime()).toBe(t.originalDueDate.getTime());
    expect(await notes('staff', 'Đã duyệt gia hạn')).toBe(1);
    // Người quản lý việc tự đề nghị thì cũng không tự duyệt được.
    await as('manager')
      .post(base)
      .send({ newDue: '2026-05-31', reason: 'Dời theo lịch nhóm' })
      .expect(201);
    const own = await ctx.prisma.taskDueChange.findFirstOrThrow({
      where: { taskId: t.id, status: 'PENDING' },
    });
    await as('manager')
      .post(`${base}/${own.id}/decide`)
      .send({ approve: true })
      .expect(403);
    await as('director')
      .post(`${base}/${own.id}/decide`)
      .send({ approve: false })
      .expect(200);
    // Hạn pháp lý.
    const legal = await ctx.prisma.task.update({
      where: { id: (await task('B03', '2026-01')).id },
      data: { isStatutory: true },
    });
    const legalBase = `/tasks/${legal.id}/due-changes`;
    await as('staff')
      .post(legalBase)
      .send({ newDue: '2026-06-30', reason: 'Khách chậm gửi chứng từ' })
      .expect(400);
    await as('manager')
      .post(legalBase)
      .send({
        newDue: '2026-06-30',
        reason: 'Công văn lùi hạn số 12',
        documented: true,
      })
      .expect(403);
    await as('director')
      .post(legalBase)
      .send({
        newDue: '2026-06-30',
        reason: 'Công văn lùi hạn số 12/CT',
        documented: true,
      })
      .expect(201);
    const legalAfter = await ctx.prisma.task.findUniqueOrThrow({
      where: { id: legal.id },
    });
    expect(legalAfter.dueDate.toISOString().slice(0, 10)).toBe('2026-06-30');
    const detail = await as('manager').get(`/tasks/${legal.id}`).expect(200);
    expect(detail.body.dueChanges[0]).toMatchObject({
      documented: true,
      status: 'APPROVED',
    });
  });

  it('thông báo: gửi kiểm tra báo người kiểm tra; trả lại báo người làm', async () => {
    const res = await as('manager')
      .post('/tasks')
      .send({
        customerId,
        title: 'Rà soát hồ sơ thuế',
        dueDate: '2026-12-31',
        assigneeId: id('staff'),
        requiresEvidence: false,
        reviewLevels: 1,
        reviewerId: id('manager'),
      })
      .expect(201);
    const t = res.body.id as string;
    await as('staff').post(`/tasks/${t}/start`).expect(200);
    await as('staff').post(`/tasks/${t}/submit`).expect(200);
    expect(
      await notes('manager', 'Việc chờ bạn kiểm tra: Rà soát hồ sơ thuế'),
    ).toBe(1);
    await as('manager')
      .post(`/tasks/${t}/review`)
      .send({ decision: 'RETURN', note: 'Thiếu bảng đối chiếu' })
      .expect(200);
    expect(
      await notes(
        'staff',
        'Việc bị trả lại: Rà soát hồ sơ thuế — Thiếu bảng đối chiếu',
      ),
    ).toBe(1);
  });
});
