/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const today = () =>
  new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

describe('04-F1 hồ sơ kiểm toán và tình trạng hồ sơ HĐ (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let auditService: string;
  let otherService: string;
  let inactiveUser: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const id = (who: keyof TestContext['users']) => ctx.users[who].id;

  /** HĐ có một dòng kiểm toán (phát hành BCKT) và một dòng dịch vụ thường. */
  const contract = async (approve = true) => {
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
    const contractId = res.body.id as string;
    if (approve) {
      await as('manager').post(`/contracts/${contractId}/submit`).expect(200);
      await as('director').post(`/contracts/${contractId}/approve`).expect(200);
    }
    const lines = await ctx.prisma.contractService.findMany({
      where: { contractId },
      select: { id: true, serviceTypeId: true },
    });
    return {
      contractId,
      lineId: lines.find((l) => l.serviceTypeId === auditService)!.id,
      otherLineId: lines.find((l) => l.serviceTypeId === otherService)!.id,
    };
  };
  const engagement = async (contractId: string) =>
    (
      await as('director')
        .get(`/contracts/${contractId}/audit-engagements`)
        .expect(200)
    ).body.engagements[0];
  const saveTeam = (
    who: keyof TestContext['users'],
    c: string,
    line: string,
    body: object,
  ) => as(who).put(`/contracts/${c}/audit-engagements/${line}`).send(body);
  const stage = (
    who: keyof TestContext['users'],
    c: string,
    line: string,
    body: object,
  ) =>
    as(who).post(`/contracts/${c}/audit-engagements/${line}/stage`).send(body);
  /** 04-F2: phải có hạn phát hành trước khi bắt đầu kiểm toán (lưu nhóm tăng revision lên 1). */
  const toAwaitingIssue = async (c: string, line: string) => {
    await saveTeam('manager', c, line, {
      revision: 0,
      issueDue: '2099-12-31',
    }).expect(200);
    for (const s of ['FIELDWORK', 'REVIEW', 'AWAITING_ISSUE']) {
      const { revision } = (await engagement(c)).engagement;
      await stage('manager', c, line, { stage: s, revision }).expect(200);
    }
  };
  const issue = (
    who: keyof TestContext['users'],
    c: string,
    line: string,
    fields: Record<string, string>,
  ) => {
    const req = as(who).post(`/contracts/${c}/audit-engagements/${line}/issue`);
    for (const [k, v] of Object.entries(fields)) void req.field(k, v);
    return req;
  };

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
          name: 'Công ty Kiểm toán Mẫu',
          taxCode: '0100000999',
          ownerId: id('staff'),
        },
      })
    ).id;
    inactiveUser = (
      await ctx.prisma.user.create({
        data: {
          email: 'nghi@test.vn',
          fullName: 'Đã nghỉ',
          passwordHash: 'x',
          isActive: false,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('chỉ dòng dịch vụ có cờ phát hành BCKT có hồ sơ; bật cờ ở danh mục có audit', async () => {
    const c = await contract(false);
    const res = await as('staff')
      .get(`/contracts/${c.contractId}/audit-engagements`)
      .expect(200);
    expect(res.body.engagements).toHaveLength(1);
    expect(res.body.engagements[0]).toMatchObject({
      lineId: c.lineId,
      year: 2025,
      engagement: { id: null, stage: 'NOT_STARTED', revision: 0 },
      canEdit: false,
    });
    expect(res.body.dossier).toMatchObject({
      clientDeliveryStatus: 'NOT_SENT',
      revision: 1,
    });
    await saveTeam('manager', c.contractId, c.otherLineId, {
      revision: 0,
    }).expect(400);

    await as('director')
      .patch(`/service-types/${otherService}`)
      .send({ issuesAuditReport: true })
      .expect(200);
    const log = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entityId: otherService, action: 'SERVICE_UPDATE' },
    });
    expect(log.detail).toMatchObject({ after: { issuesAuditReport: 'true' } });
    expect(await engagement(c.contractId)).toBeDefined();
    const both = await as('manager')
      .get(`/contracts/${c.contractId}/audit-engagements`)
      .expect(200);
    expect(both.body.engagements).toHaveLength(2);
    await as('director')
      .patch(`/service-types/${otherService}`)
      .send({ issuesAuditReport: false })
      .expect(200);
  });

  it('phân quyền: KTT và trưởng nhóm sửa; nhân viên khác, thu tiền 403; quản trị 403; ngoài phạm vi 404', async () => {
    const c = await contract();
    const url = `/contracts/${c.contractId}/audit-engagements`;
    await as('admin').get(url).expect(403);
    await as('staff2').get(url).expect(404);
    await as('cashier').get(url).expect(200);
    await saveTeam('staff', c.contractId, c.lineId, { revision: 0 }).expect(
      403,
    );
    await saveTeam('cashier', c.contractId, c.lineId, { revision: 0 }).expect(
      403,
    );
    const saved = await saveTeam('manager', c.contractId, c.lineId, {
      revision: 0,
      managerId: id('manager'),
      leadId: id('staff'),
      signer1Id: id('director'),
      assistantIds: [id('staff2')],
      issueDue: '2099-12-31',
    }).expect(200);
    const e = saved.body.engagements[0];
    expect(e.engagement).toMatchObject({
      revision: 1,
      manager: { id: id('manager') },
      lead: { id: id('staff') },
      signer1: { id: id('director') },
      assistants: [{ id: id('staff2') }],
    });
    // F6: staff2 không được phân công KH → cảnh báo, và vẫn không xem được HĐ.
    expect(e.unassigned.map((u: { id: string }) => u.id)).toEqual([
      id('staff2'),
    ]);
    await as('staff2').get(url).expect(404);
    // Trưởng nhóm (nhân viên) được sửa và chuyển giai đoạn hồ sơ của mình.
    const asLead = await as('staff').get(url).expect(200);
    expect(asLead.body.engagements[0].canEdit).toBe(true);
    await stage('staff', c.contractId, c.lineId, {
      stage: 'FIELDWORK',
      revision: 1,
    }).expect(200);
    await issue('manager', c.contractId, c.lineId, {
      revision: '2',
      reportNumber: 'X',
      reportDate: today(),
    }).expect(403);
    await as('staff')
      .put(`/contracts/${c.contractId}/dossier`)
      .send({})
      .expect(403);
  });

  it('ràng buộc nhóm, tài khoản hợp lệ và khoá lạc quan', async () => {
    const c = await contract();
    const put = (body: object) =>
      saveTeam('manager', c.contractId, c.lineId, { revision: 0, ...body });
    await put({ managerId: id('manager'), leadId: id('manager') }).expect(400);
    await put({ signer1Id: id('director'), signer2Id: id('director') }).expect(
      400,
    );
    await put({ signer2Id: id('director') }).expect(400);
    await put({ leadId: id('admin') }).expect(400);
    await put({ leadId: inactiveUser }).expect(400);
    const first = await Promise.all([
      put({ leadId: id('staff') }),
      put({ leadId: id('manager') }),
    ]);
    expect(first.map((r) => r.status).sort()).toEqual([200, 409]);
    await put({ leadId: id('staff') }).expect(409);
    await saveTeam('manager', c.contractId, c.lineId, {
      revision: 1,
      leadId: id('manager'),
    }).expect(200);
    const history = await ctx.prisma.auditEngagementRoleHistory.findMany({
      where: { engagement: { contractServiceId: c.lineId }, role: 'LEAD' },
      orderBy: { fromAt: 'asc' },
    });
    expect(history.map((h) => [h.toAt === null])).toEqual(
      history.length === 2 ? [[false], [true]] : [[true]],
    );
    expect(history.at(-1)?.userId).toBe(id('manager'));
    const log = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entityId: c.contractId, action: 'ENGAGEMENT_UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log.detail).toMatchObject({
      fields: ['leadId'],
      after: { leadId: id('manager') },
    });
  });

  it('giai đoạn: HĐ chưa duyệt không chuyển; tiến một bước; lùi phải có lý do; có mốc thực tế', async () => {
    const draft = await contract(false);
    await stage('manager', draft.contractId, draft.lineId, {
      stage: 'FIELDWORK',
      revision: 0,
    }).expect(400);
    const c = await contract();
    await stage('manager', c.contractId, c.lineId, {
      stage: 'REVIEW',
      revision: 0,
    }).expect(400);
    // 04-F2: chưa có hạn phát hành thì chưa bắt đầu kiểm toán được.
    await stage('manager', c.contractId, c.lineId, {
      stage: 'FIELDWORK',
      revision: 0,
    }).expect(400);
    await saveTeam('manager', c.contractId, c.lineId, {
      revision: 0,
      issueDue: '2099-12-31',
    }).expect(200);
    await stage('manager', c.contractId, c.lineId, {
      stage: 'FIELDWORK',
      revision: 1,
    }).expect(200);
    await stage('manager', c.contractId, c.lineId, {
      stage: 'REVIEW',
      revision: 2,
    }).expect(200);
    await stage('manager', c.contractId, c.lineId, {
      stage: 'ISSUED',
      revision: 3,
    }).expect(400);
    await stage('manager', c.contractId, c.lineId, {
      stage: 'NOT_STARTED',
      revision: 3,
    }).expect(400);
    await stage('manager', c.contractId, c.lineId, {
      stage: 'NOT_STARTED',
      revision: 3,
      reason: 'Khách chưa gửi số liệu',
    }).expect(200);
    const events = await ctx.prisma.auditEngagementStageEvent.findMany({
      where: { engagement: { contractServiceId: c.lineId } },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((e) => [e.fromStage, e.toStage, e.reason])).toEqual([
      ['NOT_STARTED', 'FIELDWORK', null],
      ['FIELDWORK', 'REVIEW', null],
      ['REVIEW', 'NOT_STARTED', 'Khách chưa gửi số liệu'],
    ]);
  });

  it('phát hành: chỉ từ Chờ phát hành, đủ số/ngày/người ký, file PDF; số BCKT không trùng; mở lại có lý do', async () => {
    const c = await contract();
    const d = await contract();
    await issue('director', c.contractId, c.lineId, {
      revision: '0',
      reportNumber: 'A',
      reportDate: today(),
    }).expect(400);
    await toAwaitingIssue(c.contractId, c.lineId);
    await toAwaitingIssue(d.contractId, d.lineId);
    const base = { revision: '4', reportDate: today() };
    await issue('director', c.contractId, c.lineId, {
      ...base,
      reportNumber: '101/BCKT',
    }).expect(400);
    await issue('director', c.contractId, c.lineId, {
      ...base,
      reportNumber: '101/BCKT',
      signer1Id: id('director'),
      reportDate: '2099-01-01',
    }).expect(400);
    await issue('director', c.contractId, c.lineId, {
      ...base,
      reportNumber: '101/BCKT',
      signer1Id: id('director'),
      reportDate: '2025-12-31',
    }).expect(400);
    const ok = await issue('director', c.contractId, c.lineId, {
      ...base,
      reportNumber: ' 101/BCKT ',
      signer1Id: id('director'),
    })
      .attach('file', PDF, 'bao-cao.pdf')
      .expect(200);
    const issued = ok.body.engagements[0].engagement;
    expect(issued).toMatchObject({
      stage: 'ISSUED',
      reportNumber: '101/BCKT',
      reportDate: today(),
    });
    const doc = await ctx.prisma.document.findUniqueOrThrow({
      where: { id: issued.reportDocumentId },
    });
    expect(doc).toMatchObject({
      category: 'SERVICE',
      contractId: c.contractId,
    });
    // F5: trùng số khác hoa thường/khoảng trắng ở hồ sơ khác.
    await issue('director', d.contractId, d.lineId, {
      ...base,
      reportNumber: '101/bckt  ',
      signer1Id: id('director'),
    }).expect(409);
    // Sau phát hành không sửa nhóm; mở lại cần Giám đốc và lý do.
    await saveTeam('manager', c.contractId, c.lineId, {
      revision: 5,
      leadId: id('staff'),
    }).expect(400);
    const reopenUrl = `/contracts/${c.contractId}/audit-engagements/${c.lineId}/reopen`;
    await as('manager')
      .post(reopenUrl)
      .send({ revision: 5, reason: 'Sửa số liệu' })
      .expect(403);
    await as('director')
      .post(reopenUrl)
      .send({ revision: 5, reason: 'ab' })
      .expect(400);
    const reopened = await as('director')
      .post(reopenUrl)
      .send({ revision: 5, reason: 'Sửa số liệu' })
      .expect(200);
    expect(reopened.body.engagements[0].engagement).toMatchObject({
      stage: 'AWAITING_ISSUE',
      reportNumber: '101/BCKT',
    });
    const again = await Promise.all(
      [1, 2].map(() =>
        issue('director', c.contractId, c.lineId, {
          revision: '6',
          reportNumber: '101/BCKT',
          reportDate: today(),
        }),
      ),
    );
    expect(again.map((r) => r.status).sort()).toEqual([200, 409]);
    const history = await as('manager')
      .get(`/contracts/${c.contractId}/history?pageSize=50`)
      .expect(200);
    const items: { action: string; detail: { path?: string } }[] =
      history.body.items;
    const actions = items.map((i) => i.action);
    expect(actions.filter((a) => a === 'REPORT_ISSUE')).toHaveLength(2);
    expect(actions).toContain('REPORT_REOPEN');
    expect(actions).toContain('ENGAGEMENT_STAGE');
    // Bản ghi chung của interceptor cho cùng thao tác bị bỏ, lịch sử không lặp.
    expect(
      items.filter((i) => i.detail.path?.includes('audit-engagements')),
    ).toEqual([]);
  });

  it('tình trạng hồ sơ HĐ: nháp chỉ ghi bản mềm; ngày bắt buộc; BBNT "Đã ký" phải có bản đã ký loại BBNT', async () => {
    const draft = await contract(false);
    const body = (patch: object) => ({
      revision: 1,
      clientDeliveryStatus: 'NOT_SENT',
      originalFilingStatus: 'NOT_FILED',
      acceptanceStatus: 'NONE',
      ...patch,
    });
    const put = (c: string, patch: object) =>
      as('manager').put(`/contracts/${c}/dossier`).send(body(patch));
    await put(draft.contractId, {
      clientDeliveryStatus: 'HARD_COPY',
      clientDeliveredAt: today(),
    }).expect(400);
    await put(draft.contractId, { clientDeliveryStatus: 'SOFT_COPY' }).expect(
      400,
    );
    await put(draft.contractId, {
      clientDeliveryStatus: 'SOFT_COPY',
      clientDeliveredAt: today(),
    }).expect(200);

    const c = await contract();
    await put(c.contractId, {
      originalFilingStatus: 'FILED',
      originalFiledAt: '2099-01-01',
    }).expect(400);
    await put(c.contractId, {
      acceptanceStatus: 'SIGNED',
      acceptanceSignedAt: today(),
    }).expect(400);
    const upload = (type: string) =>
      as('manager')
        .post(`/contracts/${c.contractId}/documents/signed`)
        .field('type', type)
        .attach('file', PDF, `${type}.pdf`)
        .expect(201);
    const contractScan = await upload('CONTRACT');
    await put(c.contractId, {
      acceptanceStatus: 'SIGNED',
      acceptanceSignedAt: today(),
      acceptanceDocumentId: contractScan.body.id,
    }).expect(400);
    const acceptance = await upload('ACCEPTANCE');
    const res = await put(c.contractId, {
      clientDeliveryStatus: 'HARD_AND_SOFT',
      clientDeliveredAt: today(),
      originalFilingStatus: 'FILED',
      originalFiledAt: today(),
      originalFilingNote: 'Tủ 3, ngăn 2',
      acceptanceStatus: 'SIGNED',
      acceptanceSignedAt: today(),
      acceptanceDocumentId: acceptance.body.id,
    }).expect(200);
    expect(res.body.dossier).toMatchObject({
      revision: 2,
      originalFilingNote: 'Tủ 3, ngăn 2',
      acceptanceStatus: 'SIGNED',
      acceptanceDocument: {
        id: acceptance.body.id,
        fileName: 'ACCEPTANCE.pdf',
      },
    });
    await put(c.contractId, {}).expect(409);
    const log = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entityId: c.contractId, action: 'DOSSIER_UPDATE' },
    });
    expect((log.detail as { fields: string[] }).fields).toContain(
      'acceptanceStatus',
    );
  });
});
