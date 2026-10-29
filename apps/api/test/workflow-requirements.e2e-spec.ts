/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

const STEPS = [
  {
    key: 'B01',
    name: 'Rà soát điều kiện hoàn thuế',
    dueOffsetDays: 7,
    dependsOn: [],
  },
  {
    key: 'B02',
    name: 'Lập hồ sơ đề nghị hoàn thuế',
    dueOffsetDays: 20,
    dependsOn: ['B01'],
  },
];
const REQUIREMENTS = [
  { name: 'Tờ khai thuế GTGT', stepKey: 'B02', perPeriod: true },
  { name: 'Bảng kê hóa đơn', stepKey: 'B02', category: 'SERVICE' },
  { name: 'Hồ sơ xuất khẩu', required: false, instructions: 'Nếu có' },
];

describe('Workflow document requirements (e2e)', () => {
  let ctx: TestContext;
  let versionId: string;
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const save = (
    who: keyof TestContext['users'],
    body: Record<string, unknown>,
  ) => as(who).put(`/workflow-versions/${versionId}`).send(body);

  beforeAll(async () => {
    ctx = await createTestContext();
    const service = await ctx.prisma.serviceType.create({
      data: { code: 'HT', name: 'Hoàn thuế', cycle: 'ONE_TIME' },
    });
    const template = await as('manager')
      .post('/workflow-templates')
      .send({ serviceTypeId: service.id, name: 'Hoàn thuế GTGT' })
      .expect(201);
    versionId = template.body.draftVersion.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('lưu danh sách hồ sơ cùng bản nháp, gắn bước theo khoá, giữ thứ tự và mặc định', async () => {
    const res = await save('manager', {
      revision: 1,
      scheduleMode: 'PERIODIC',
      steps: STEPS,
      requirements: REQUIREMENTS,
    }).expect(200);
    expect(res.body.requirements).toEqual([
      {
        name: 'Tờ khai thuế GTGT',
        instructions: null,
        required: true,
        category: 'SERVICE',
        perPeriod: true,
        stepKey: 'B02',
      },
      {
        name: 'Bảng kê hóa đơn',
        instructions: null,
        required: true,
        category: 'SERVICE',
        perPeriod: false,
        stepKey: 'B02',
      },
      {
        name: 'Hồ sơ xuất khẩu',
        instructions: 'Nếu có',
        required: false,
        category: 'SERVICE',
        perPeriod: false,
        stepKey: null,
      },
    ]);
    const staff = await as('staff')
      .get(`/workflow-versions/${versionId}`)
      .expect(200);
    expect(staff.body.requirements).toHaveLength(3);
  });

  it('không gửi requirements thì giữ nguyên danh sách và vẫn gắn đúng bước sau khi ghi lại bước', async () => {
    const res = await save('manager', {
      revision: 2,
      scheduleMode: 'PERIODIC',
      steps: STEPS.map((s) => ({ ...s, name: `${s.name} ` })),
    }).expect(200);
    expect(
      res.body.requirements.map((r: { stepKey: string | null }) => r.stepKey),
    ).toEqual(['B02', 'B02', null]);
  });

  it('hồ sơ gắn bước không tồn tại hoặc trùng tên bị từ chối; nhân viên không sửa được', async () => {
    const unknown = await save('manager', {
      revision: 3,
      scheduleMode: 'PERIODIC',
      steps: STEPS,
      requirements: [{ name: 'Bảng lương', stepKey: 'B09' }],
    }).expect(400);
    expect(unknown.body.message).toBe(
      'Hồ sơ "Bảng lương": bước B09 không có trong phiên bản',
    );
    await save('manager', {
      revision: 3,
      scheduleMode: 'PERIODIC',
      steps: STEPS,
      requirements: [{ name: 'Bảng kê' }, { name: 'bảng kê' }],
    }).expect(400);
    await save('staff', {
      revision: 3,
      scheduleMode: 'PERIODIC',
      steps: STEPS,
      requirements: [],
    }).expect(403);
  });

  it('xoá bước đang có hồ sơ gắn vào mà giữ danh sách cũ thì báo lỗi rõ', async () => {
    const res = await save('manager', {
      revision: 3,
      scheduleMode: 'PERIODIC',
      steps: [STEPS[0]],
    }).expect(400);
    expect(res.body.message).toMatch(/bước B02 không có trong phiên bản/);
  });

  it('phát hành rồi thì danh sách hồ sơ bất biến; nhân bản chép hồ sơ và gắn sang bước mới', async () => {
    await as('director')
      .post(`/workflow-versions/${versionId}/publish`)
      .expect(201);
    await save('director', {
      revision: 3,
      scheduleMode: 'PERIODIC',
      steps: STEPS,
      requirements: [],
    }).expect(409);
    const clone = await as('manager')
      .post(`/workflow-versions/${versionId}/clone`)
      .send({})
      .expect(201);
    expect(clone.body.requirements).toHaveLength(3);
    const linked = await ctx.prisma.documentRequirement.findMany({
      where: { versionId: clone.body.id, stepId: { not: null } },
      include: { step: true },
    });
    expect(linked).toHaveLength(2);
    expect(linked.every((r) => r.step?.versionId === clone.body.id)).toBe(true);
    const original = await as('staff')
      .get(`/workflow-versions/${versionId}`)
      .expect(200);
    expect(original.body.requirements).toHaveLength(3);
  });
});
