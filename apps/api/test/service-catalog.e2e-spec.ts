/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

describe('Service catalog (e2e)', () => {
  let ctx: TestContext;
  let serviceId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('giám đốc tạo dịch vụ', async () => {
    const res = await ctx
      .api(ctx.users.director)
      .post('/service-types')
      .send({
        code: 'ktt',
        name: 'Kế toán thuế',
        cycle: 'MONTHLY',
        defaultPrice: 1500000,
      })
      .expect(201);
    expect(res.body.code).toBe('KTT');
    expect(res.body.defaultPrice).toBe('1500000');
    serviceId = res.body.id;
  });

  it('trùng mã → 409', async () => {
    await ctx
      .api(ctx.users.director)
      .post('/service-types')
      .send({ code: 'KTT', name: 'Trùng', cycle: 'MONTHLY' })
      .expect(409);
  });

  it('API việc mẫu cũ đã bỏ; nhân viên đọc quy trình đang hiệu lực theo thứ tự bước', async () => {
    // Đặc tả 03 D3 thay PUT task-templates bằng phiên bản quy trình; giữ kiểm chứng thứ tự và quyền đọc.
    await ctx
      .api(ctx.users.director)
      .put(`/service-types/${serviceId}/task-templates`)
      .send({ items: [{ title: 'Nhận chứng từ' }] })
      .expect(404);
    const template = await ctx
      .api(ctx.users.director)
      .post('/workflow-templates')
      .send({ serviceTypeId: serviceId, name: 'Quy trình kế toán thuế' })
      .expect(201);
    const draft = template.body.draftVersion;
    await ctx
      .api(ctx.users.director)
      .put(`/workflow-versions/${draft.id}`)
      .send({
        revision: 1,
        scheduleMode: 'PERIODIC',
        steps: [
          {
            key: 'B01',
            name: 'Nhận chứng từ',
            dueOffsetDays: 5,
            dependsOn: [],
          },
          {
            key: 'B02',
            name: 'Lập tờ khai GTGT',
            dueOffsetDays: 18,
            requiresEvidence: true,
            dependsOn: ['B01'],
          },
        ],
      })
      .expect(200);
    await ctx
      .api(ctx.users.director)
      .post(`/workflow-versions/${draft.id}/publish`)
      .expect(201);
    const res = await ctx
      .api(ctx.users.staff)
      .get(`/service-types/${serviceId}/effective-workflow`)
      .expect(200);
    expect(res.body.steps.map((t: { name: string }) => t.name)).toEqual([
      'Nhận chứng từ',
      'Lập tờ khai GTGT',
    ]);
    const list = await ctx
      .api(ctx.users.staff)
      .get('/service-types')
      .expect(200);
    expect(list.body[0].defaultWorkflow).toMatchObject({
      versionNo: 1,
      stepCount: 2,
    });
  });

  it('nhân viên không sửa được dịch vụ (403)', async () => {
    await ctx
      .api(ctx.users.staff)
      .patch(`/service-types/${serviceId}`)
      .send({ name: 'Đổi tên' })
      .expect(403);
  });
});
