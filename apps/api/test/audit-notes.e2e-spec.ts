/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

/** 04-F4: mức độ và báo cáo tình hình cụ thể của hồ sơ kiểm toán (bám bảng LTGroup). */
describe('04-F4 mức độ và báo cáo tình hình (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let auditService: string;
  let otherService: string;
  let contractId: string;
  let lineId: string;
  let otherLineId: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const id = (who: keyof TestContext['users']) => ctx.users[who].id;
  const base = () => `/contracts/${contractId}/audit-engagements/${lineId}`;
  const engagement = async () =>
    (
      await as('director')
        .get(`/contracts/${contractId}/audit-engagements`)
        .expect(200)
    ).body.engagements[0];

  beforeAll(async () => {
    ctx = await createTestContext();
    auditService = (
      await ctx.prisma.serviceType.create({
        data: { code: 'KT', name: 'Kiểm toán', issuesAuditReport: true },
      })
    ).id;
    otherService = (
      await ctx.prisma.serviceType.create({
        data: { code: 'KTT', name: 'Kế toán thuế' },
      })
    ).id;
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Tình Hình',
          taxCode: '0100000666',
          ownerId: id('staff'),
        },
      })
    ).id;
    const res = await as('manager')
      .post('/contracts')
      .send({
        customerId,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        vatRate: 10,
        services: [
          {
            serviceTypeId: auditService,
            period: '2025',
            quantity: 1,
            unitPrice: '1000000',
          },
          {
            serviceTypeId: otherService,
            period: '2026-01',
            quantity: 1,
            unitPrice: '500000',
          },
        ],
      })
      .expect(201);
    contractId = res.body.id;
    const lines = await ctx.prisma.contractService.findMany({
      where: { contractId },
    });
    lineId = lines.find((l) => l.serviceTypeId === auditService)!.id;
    otherLineId = lines.find((l) => l.serviceTypeId === otherService)!.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('mặc định Trung bình, chưa có tình hình; nhân viên ngoài nhóm không sửa/ghi được', async () => {
    const e = await engagement();
    expect(e.engagement).toMatchObject({ priority: 'NORMAL', notes: [] });
    expect(e.engagement.id).toBeNull();
    const staffView = (
      await as('staff')
        .get(`/contracts/${contractId}/audit-engagements`)
        .expect(200)
    ).body.engagements[0];
    expect(staffView).toMatchObject({ canPrioritize: false, canNote: false });
    await as('staff')
      .put(`${base()}/priority`)
      .send({ priority: 'HIGH' })
      .expect(403);
    await as('staff')
      .post(`${base()}/notes`)
      .send({ content: 'Khách chậm số liệu' })
      .expect(403);
  });

  it('KTT đặt mức độ: tạo hồ sơ nếu chưa có, không đổi revision, ghi lịch sử HĐ', async () => {
    const res = await as('manager')
      .put(`${base()}/priority`)
      .send({ priority: 'URGENT' })
      .expect(200);
    const e = res.body.engagements[0].engagement;
    expect(e).toMatchObject({ priority: 'URGENT', revision: 1 });
    expect(e.id).toBeTruthy();
    await as('manager')
      .put(`${base()}/priority`)
      .send({ priority: 'BAD' })
      .expect(400);
    const history = await as('director')
      .get(`/contracts/${contractId}/history`)
      .expect(200);
    expect(
      history.body.items.find(
        (i: { action: string }) => i.action === 'ENGAGEMENT_PRIORITY',
      ).detail,
    ).toMatchObject({ from: 'NORMAL', to: 'URGENT' });
  });

  it('nhật ký tình hình chỉ thêm, mới nhất trước; thành viên nhóm được ghi', async () => {
    await as('manager')
      .post(`${base()}/notes`)
      .send({ content: ' ' })
      .expect(400);
    await as('manager')
      .post(`${base()}/notes`)
      .send({ content: 'Đã gửi danh mục tài liệu cho khách' })
      .expect(201);
    // Đưa nhân viên vào nhóm làm trợ lý → được ghi tình hình (không cần contracts:plan).
    const { revision } = (await engagement()).engagement;
    await as('manager')
      .put(base())
      .send({ revision, assistantIds: [id('staff')] })
      .expect(200);
    const res = await as('staff')
      .post(`${base()}/notes`)
      .send({ content: 'Khách hẹn gửi sổ phụ ngân hàng ngày 25/10' })
      .expect(201);
    const view = res.body.engagements[0];
    expect(view.canNote).toBe(true);
    expect(view.canPrioritize).toBe(false);
    expect(
      view.engagement.notes.map(
        (n: { content: string; author: { id: string } }) => [
          n.content,
          n.author.id,
        ],
      ),
    ).toEqual([
      ['Khách hẹn gửi sổ phụ ngân hàng ngày 25/10', id('staff')],
      ['Đã gửi danh mục tài liệu cho khách', id('manager')],
    ]);
  });

  it('bảng theo dõi: cột mức độ, tình hình gần nhất, lọc và sắp theo mức độ', async () => {
    const board = await as('director')
      .get('/contracts/audit-tracking')
      .expect(200);
    const row = board.body.items.find(
      (r: { lineId: string }) => r.lineId === lineId,
    );
    expect(row).toMatchObject({
      priority: 'URGENT',
      lastNote: {
        content: 'Khách hẹn gửi sổ phụ ngân hàng ngày 25/10',
        author: { id: id('staff') },
      },
    });
    const urgent = await as('director')
      .get('/contracts/audit-tracking?priority=URGENT')
      .expect(200);
    expect(urgent.body.items.map((r: { lineId: string }) => r.lineId)).toEqual([
      lineId,
    ]);
    const low = await as('director')
      .get('/contracts/audit-tracking?priority=LOW')
      .expect(200);
    expect(low.body.total).toBe(0);
    await as('director')
      .get('/contracts/audit-tracking?sort=priority&order=desc')
      .expect(200);
  });

  it('dòng không phát hành BCKT → 400; HĐ huỷ chỉ xem', async () => {
    await as('manager')
      .put(`/contracts/${contractId}/audit-engagements/${otherLineId}/priority`)
      .send({ priority: 'HIGH' })
      .expect(400);
    await ctx.prisma.contract.update({
      where: { id: contractId },
      data: { status: 'CANCELLED' },
    });
    await as('manager')
      .post(`${base()}/notes`)
      .send({ content: 'Sau khi huỷ' })
      .expect(400);
    const view = await engagement();
    expect(view).toMatchObject({ canPrioritize: false, canNote: false });
  });
});
