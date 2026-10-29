/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- res.body của supertest có kiểu any */
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTRACT_APPROVED,
  ContractApprovedEvent,
} from '../src/common/events/app-events';
import { confirmDefaultPlans } from './utils/plans';
import { createTestContext, TestContext } from './utils/test-app';

const DURATIONS = [2, 3, 2, 5, 5, 5, 5, 10, 3, 3, 2, 1];
const NAMES = [
  'Tiếp nhận hồ sơ',
  'Kiểm tra dữ liệu',
  'Lập danh sách hồ sơ thiếu',
  'Đối chiếu số dư',
  'Kiểm tra hóa đơn',
  'Kiểm tra lương, BHXH',
  'Kiểm tra hàng tồn kho',
  'Hoàn thiện sổ sách',
  'Lập báo cáo tài chính',
  'Kiểm tra nội bộ',
  'Phê duyệt',
  'Bàn giao khách hàng',
];
const key = (i: number) => `B${String(i + 1).padStart(2, '0')}`;

/** Mẫu 12 bước PL1 nối tiếp; `parallel` cho 3 bước kiểm tra hoá đơn/lương/tồn kho chạy song song. */
function rebuildBooks(parallel = false) {
  return NAMES.map((name, i) => {
    let dependsOn = i === 0 ? [] : [key(i - 1)];
    if (parallel && (i === 5 || i === 6)) dependsOn = [key(3)];
    if (parallel && i === 7) dependsOn = [key(4), key(5), key(6)];
    return {
      key: key(i),
      name,
      durationDays: DURATIONS[i],
      reviewLevels: i < 9 ? 1 : 0,
      reviewerRole: i < 9 ? 'MANAGER' : null,
      dependsOn,
    };
  });
}

describe('Workflow templates (e2e)', () => {
  let ctx: TestContext;
  let serviceId: string;
  let otherServiceId: string;
  let templateId: string;
  let v1: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const save = (
    who: keyof TestContext['users'],
    id: string,
    body: Record<string, unknown>,
  ) => as(who).put(`/workflow-versions/${id}`).send(body);

  beforeAll(async () => {
    ctx = await createTestContext();
    const service = await ctx.prisma.serviceType.create({
      data: { code: 'LLSS', name: 'Làm lại sổ sách', cycle: 'ONE_TIME' },
    });
    const other = await ctx.prisma.serviceType.create({
      data: { code: 'HT', name: 'Hoàn thuế', cycle: 'ONE_TIME' },
    });
    serviceId = service.id;
    otherServiceId = other.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('trưởng nhóm tạo và sửa bản nháp nhưng không phát hành; mã QT tự sinh', async () => {
    const res = await as('manager')
      .post('/workflow-templates')
      .send({ serviceTypeId: serviceId, name: 'Làm lại sổ sách 2018–2026' })
      .expect(201);
    templateId = res.body.id;
    v1 = res.body.draftVersion.id;
    expect(res.body.code).toBe('QT-LLSS-001');
    expect(res.body.draftVersion.scheduleMode).toBe('PROJECT');
    const saved = await save('manager', v1, {
      revision: 1,
      scheduleMode: 'PROJECT',
      steps: rebuildBooks(),
    }).expect(200);
    expect(saved.body.revision).toBe(2);
    expect(saved.body.steps[1].dependsOn).toEqual(['B01']);
    await as('manager').post(`/workflow-versions/${v1}/publish`).expect(403);
  });

  it('phân quyền đọc: nhân viên xem được, thu tiền và quản trị bị 403', async () => {
    await as('staff').get('/workflow-templates').expect(200);
    await as('staff').get(`/workflow-versions/${v1}`).expect(200);
    await as('staff')
      .post('/workflow-templates')
      .send({ serviceTypeId: serviceId, name: 'Không được' })
      .expect(403);
    await save('staff', v1, {
      revision: 2,
      scheduleMode: 'PROJECT',
      steps: [],
    }).expect(403);
    await as('cashier').get('/workflow-templates').expect(403);
    await as('admin').get('/workflow-templates').expect(403);
  });

  it('xem trước mẫu 12 bước ra 46 ngày làm việc', async () => {
    const res = await as('staff')
      .get(`/workflow-versions/${v1}/preview?startDate=2026-11-02`)
      .expect(200);
    expect(res.body.totalWorkingDays).toBe(46);
    expect(res.body.steps[0]).toMatchObject({
      key: 'B01',
      start: '2026-11-02',
      end: '2026-11-03',
    });
  });

  it('vòng phụ thuộc, tự phụ thuộc bị từ chối và chỉ rõ bước', async () => {
    const steps = rebuildBooks();
    steps[0].dependsOn = ['B12'];
    const cycle = await save('manager', v1, {
      revision: 2,
      scheduleMode: 'PROJECT',
      steps,
    }).expect(400);
    expect(cycle.body.message).toMatch(/^Vòng phụ thuộc: "Tiếp nhận hồ sơ"/);
    const self = rebuildBooks();
    self[2].dependsOn = ['B03'];
    await save('manager', v1, {
      revision: 2,
      scheduleMode: 'PROJECT',
      steps: self,
    }).expect(400);
  });

  it('hai người sửa cùng bản nháp: người lưu sau với revision cũ nhận 409', async () => {
    const body = {
      revision: 2,
      scheduleMode: 'PROJECT',
      steps: rebuildBooks(true),
    };
    await save('manager', v1, body).expect(200);
    const late = await save('director', v1, body).expect(409);
    expect(late.body.message).toMatch(/tải lại/);
    const preview = await as('director')
      .get(`/workflow-versions/${v1}/preview?startDate=2026-11-02`)
      .expect(200);
    expect(preview.body.totalWorkingDays).toBe(36);
  });

  it('thiếu thời lượng thì không phát hành được', async () => {
    const steps = rebuildBooks(true);
    steps[4] = { ...steps[4], durationDays: undefined as unknown as number };
    await save('manager', v1, {
      revision: 3,
      scheduleMode: 'PROJECT',
      steps,
    }).expect(200);
    const res = await as('director')
      .post(`/workflow-versions/${v1}/publish`)
      .expect(400);
    expect(res.body.message).toBe(
      'Bước "Kiểm tra hóa đơn" (B05): thời lượng phải từ 1 đến 365 ngày làm việc',
    );
    await save('manager', v1, {
      revision: 4,
      scheduleMode: 'PROJECT',
      steps: rebuildBooks(true),
    }).expect(200);
  });

  it('người mặc định đã nghỉ việc bị từ chối', async () => {
    const left = await ctx.prisma.user.create({
      data: {
        email: 'left@test.vn',
        fullName: 'Đã nghỉ',
        passwordHash: 'x',
        leftAt: new Date(),
      },
    });
    const steps = rebuildBooks(true);
    steps[0] = { ...steps[0], defaultAssigneeId: left.id } as (typeof steps)[0];
    const res = await save('manager', v1, {
      revision: 5,
      scheduleMode: 'PROJECT',
      steps,
    }).expect(400);
    expect(res.body.message).toMatch(/đang hoạt động/);
  });

  it('phát hành đồng thời: đúng một lần thành công; thành mặc định và có nhật ký', async () => {
    const results = await Promise.all(
      [1, 2].map(() => as('director').post(`/workflow-versions/${v1}/publish`)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const template = await as('staff')
      .get(`/workflow-templates/${templateId}`)
      .expect(200);
    expect(template.body).toMatchObject({ isDefault: true });
    expect(template.body.activeVersion.id).toBe(v1);
    await save('director', v1, {
      revision: 5,
      scheduleMode: 'PROJECT',
      steps: rebuildBooks(),
    }).expect(409);
    const log = await ctx.prisma.auditLog.findFirst({
      where: {
        action: 'APPROVE',
        entity: 'workflow-templates',
        entityId: templateId,
      },
    });
    expect(log?.detail).toMatchObject({
      operation: 'PUBLISH',
      toVersion: 1,
      steps: 12,
    });
  });

  it('nhân bản thành bản nháp v2 (ánh xạ phụ thuộc), chỉ một bản nháp; nhân bản sang dịch vụ khác ra mã mới', async () => {
    const v2 = await as('manager')
      .post(`/workflow-versions/${v1}/clone`)
      .send({})
      .expect(201);
    expect(v2.body).toMatchObject({
      versionNo: 2,
      status: 'DRAFT',
      clonedFromId: v1,
    });
    expect(v2.body.steps[7].dependsOn).toEqual(['B05', 'B06', 'B07']);
    const copied = await ctx.prisma.workflowStep.findMany({
      where: { versionId: { in: [v1, v2.body.id] } },
      select: { id: true },
    });
    expect(new Set(copied.map((s) => s.id)).size).toBe(24);
    // Hồi quy: bước đọc từ API gửi lại nguyên dạng phải lưu được (giao diện làm như vậy).
    const roundTrip = await save('manager', v2.body.id, {
      revision: v2.body.revision,
      scheduleMode: v2.body.scheduleMode,
      steps: v2.body.steps,
    }).expect(200);
    expect(roundTrip.body.steps).toEqual(v2.body.steps);
    await as('manager')
      .post(`/workflow-versions/${v1}/clone`)
      .send({})
      .expect(409);
    const copy = await as('manager')
      .post(`/workflow-versions/${v1}/clone`)
      .send({ serviceTypeId: otherServiceId, name: 'Hoàn thuế theo dự án' })
      .expect(201);
    expect(copy.body.template.code).toBe('QT-HT-001');
    expect(copy.body.versionNo).toBe(1);
  });

  it('xoá bản nháp của quy trình chưa từng phát hành thì xoá luôn quy trình', async () => {
    const created = await as('manager')
      .post('/workflow-templates')
      .send({ serviceTypeId: otherServiceId, name: 'Nháp bỏ đi' })
      .expect(201);
    await as('manager')
      .delete(`/workflow-versions/${created.body.draftVersion.id}`)
      .expect(200);
    await as('manager')
      .get(`/workflow-templates/${created.body.id}`)
      .expect(404);
    await as('manager').delete(`/workflow-versions/${v1}`).expect(409);
  });

  it('sinh việc theo phiên bản đang hiệu lực; phát hành v2 không đổi việc đã sinh', async () => {
    const customer = await ctx.prisma.customer.create({
      data: { name: 'Công ty ABC', taxCode: '0109999002' },
    });
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-2026-001',
        customerId: customer.id,
        ownerId: ctx.users.staff.id,
        startDate: new Date('2026-11-02'),
        status: 'NOT_STARTED',
        services: {
          create: { serviceTypeId: serviceId, unitPrice: '1', amount: '1' },
        },
      },
    });
    const event: ContractApprovedEvent = {
      contractId: contract.id,
      approvedById: ctx.users.director.id,
    };
    // Đặc tả 04-B (E1): xác nhận kế hoạch (chụp phiên bản đang hiệu lực) trước khi sinh việc.
    await confirmDefaultPlans(ctx.prisma, contract.id, ctx.users.director.id);
    await ctx.app.get(EventEmitter2).emitAsync(CONTRACT_APPROVED, event);
    const tasks = await ctx.prisma.task.findMany({
      where: { contractId: contract.id },
      orderBy: { dueDate: 'asc' },
    });
    expect(tasks).toHaveLength(12);
    expect(tasks[0].dueDate.toISOString().slice(0, 10)).toBe('2026-11-03');
    expect(tasks.at(-1)!.dueDate.toISOString().slice(0, 10)).toBe('2026-12-21');

    const draft = (await as('staff').get(`/workflow-templates/${templateId}`))
      .body.draftVersion;
    await save('manager', draft.id, {
      revision: 2,
      scheduleMode: 'PROJECT',
      steps: rebuildBooks(true).map((s) => ({ ...s, name: `${s.name} (v2)` })),
    }).expect(200);
    await as('director')
      .post(`/workflow-versions/${draft.id}/publish`)
      .expect(201);
    const v1After = await as('staff')
      .get(`/workflow-versions/${v1}`)
      .expect(200);
    expect(v1After.body.status).toBe('RETIRED');
    await ctx.app.get(EventEmitter2).emitAsync(CONTRACT_APPROVED, event);
    const after = await ctx.prisma.task.findMany({
      where: { contractId: contract.id },
    });
    expect(after).toHaveLength(12);
    expect(after.some((t) => t.title.endsWith('(v2)'))).toBe(false);
  });

  it('chỉ giám đốc đổi quy trình mặc định', async () => {
    const other = await ctx.prisma.workflowTemplate.findFirstOrThrow({
      where: { code: 'QT-HT-001' },
    });
    await as('manager')
      .patch(`/workflow-templates/${other.id}`)
      .send({ isDefault: true })
      .expect(403);
    await as('manager')
      .patch(`/workflow-templates/${other.id}`)
      .send({ name: 'Hoàn thuế (dự án)' })
      .expect(200);
  });
});
