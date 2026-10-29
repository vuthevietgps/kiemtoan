/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

/** Ngày nghiệp vụ theo giờ Việt Nam, lệch `days` ngày so với hôm nay. */
const inDays = (days: number) => {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  )
    .toISOString()
    .slice(0, 10);
};

type Who = keyof TestContext['users'];

describe('04-F2 hạn hồ sơ kiểm toán và đúng hạn theo nhân sự (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let auditService: string;

  const as = (who: Who) => ctx.api(ctx.users[who]);
  const id = (who: Who) => ctx.users[who].id;

  const approvedLine = async (serviceTypeId = auditService) => {
    const res = await as('manager')
      .post('/contracts')
      .send({
        customerId,
        startDate: inDays(-120),
        vatRate: 10,
        services: [
          {
            serviceTypeId,
            period: '2025',
            quantity: 1,
            unitPrice: '1000000',
          },
        ],
      })
      .expect(201);
    const c = res.body.id as string;
    await as('manager').post(`/contracts/${c}/submit`).expect(200);
    await as('director').post(`/contracts/${c}/approve`).expect(200);
    const line = await ctx.prisma.contractService.findFirstOrThrow({
      where: { contractId: c },
    });
    return { c, line: line.id };
  };
  const base = (c: string, line: string) =>
    `/contracts/${c}/audit-engagements/${line}`;
  const view = async (c: string) =>
    (await as('director').get(`/contracts/${c}/audit-engagements`).expect(200))
      .body.engagements[0].engagement;
  const team = {
    managerId: '',
    leadId: '',
    signer1Id: '',
  };
  const save = (c: string, line: string, body: object) =>
    as('manager')
      .put(base(c, line))
      .send({ ...team, ...body });
  const stage = (who: Who, c: string, line: string, body: object) =>
    as(who)
      .post(`${base(c, line)}/stage`)
      .send(body);
  const extend = (
    who: Who,
    c: string,
    line: string,
    kind: string,
    body: object,
  ) =>
    as(who)
      .post(`${base(c, line)}/deadlines/${kind}/extend`)
      .send(body);
  const people = (who: Who, query = '') =>
    as(who).get(
      `/contracts/audit-tracking/people?from=${inDays(-60)}&to=${inDays(90)}${query}`,
    );
  /** Giả lập nhóm đã được giao từ 10 ngày trước (trước các hạn trong quá khứ). */
  const backdateTeam = (line: string) =>
    ctx.prisma.auditEngagementRoleHistory.updateMany({
      where: { engagement: { contractServiceId: line } },
      data: { fromAt: new Date(Date.now() - 10 * 86_400_000) },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    team.managerId = id('manager');
    team.leadId = id('staff');
    team.signer1Id = id('director');
    auditService = (
      await ctx.prisma.serviceType.create({
        data: { code: 'KT', name: 'Kiểm toán', issuesAuditReport: true },
      })
    ).id;
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Hạn Kiểm toán',
          taxCode: '0100000777',
          ownerId: id('staff'),
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('sửa hạn tự do trước khi chốt; chốt hạn gốc khi bắt đầu; chỉ Giám đốc gia hạn, có lý do, giữ hạn gốc', async () => {
    const { c, line } = await approvedLine();
    await save(c, line, {
      revision: 0,
      fieldworkDue: inDays(10),
      reviewDue: inDays(5),
    }).expect(400);
    await save(c, line, {
      revision: 0,
      fieldworkDue: inDays(5),
      reviewDue: inDays(10),
      issueDue: inDays(20),
    }).expect(200);
    await save(c, line, { revision: 1, issueDue: inDays(25) }).expect(200);
    let e = await view(c);
    expect(e).toMatchObject({ deadlinesLocked: false, revision: 2 });
    expect(
      e.deadlines.map(
        (d: { kind: string; originalDue: string; currentDue: string }) => [
          d.kind,
          d.originalDue,
          d.currentDue,
        ],
      ),
    ).toEqual([
      ['FIELDWORK_END', inDays(5), inDays(5)],
      ['REVIEW_END', inDays(10), inDays(10)],
      ['REPORT_ISSUE', inDays(25), inDays(25)],
    ]);
    expect(e.deadlines[0].current).toEqual({ result: 'DUE_SOON', days: 5 });

    await stage('manager', c, line, { stage: 'FIELDWORK', revision: 2 }).expect(
      200,
    );
    await save(c, line, { revision: 3, issueDue: inDays(30) }).expect(400);
    await save(c, line, { revision: 3, issueDue: inDays(25) }).expect(200);
    await extend('manager', c, line, 'REPORT_ISSUE', {
      revision: 4,
      due: inDays(40),
      reason: 'Khách chậm gửi số liệu',
    }).expect(403);
    await extend('director', c, line, 'REPORT_ISSUE', {
      revision: 4,
      due: inDays(40),
      reason: 'ab',
    }).expect(400);
    await extend('director', c, line, 'REPORT_ISSUE', {
      revision: 3,
      due: inDays(40),
      reason: 'Khách chậm gửi số liệu',
    }).expect(409);
    await extend('director', c, line, 'FIELDWORK_END', {
      revision: 4,
      due: inDays(50),
      reason: 'Quá thứ tự hạn',
    }).expect(400);
    await extend('director', c, line, 'NOPE', {
      revision: 4,
      due: inDays(40),
      reason: 'Sai loại hạn',
    }).expect(400);
    const extended = await extend('director', c, line, 'REPORT_ISSUE', {
      revision: 4,
      due: inDays(40),
      reason: 'Khách chậm gửi số liệu',
    }).expect(200);
    e = extended.body.engagements[0].engagement;
    expect(e).toMatchObject({ deadlinesLocked: true, revision: 5 });
    expect(e.deadlines[2]).toMatchObject({
      kind: 'REPORT_ISSUE',
      originalDue: inDays(25),
      currentDue: inDays(40),
      extended: true,
      changes: [
        {
          oldDue: inDays(25),
          newDue: inDays(40),
          reason: 'Khách chậm gửi số liệu',
          changedBy: { id: id('director') },
        },
      ],
    });
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: c, action: 'DEADLINE_EXTEND' },
      }),
    ).toBe(1);

    // Mốc đạt lần đầu: lùi rồi tiến lại không đổi; hạn đã đạt không gia hạn được.
    await stage('manager', c, line, { stage: 'REVIEW', revision: 5 }).expect(
      200,
    );
    const first = (await view(c)).deadlines[0].achievedAt;
    expect(first).not.toBeNull();
    await extend('director', c, line, 'FIELDWORK_END', {
      revision: 6,
      due: inDays(8),
      reason: 'Gia hạn hạn đã đạt',
    }).expect(400);
    await stage('manager', c, line, {
      stage: 'FIELDWORK',
      revision: 6,
      reason: 'Bổ sung thủ tục',
    }).expect(200);
    await stage('manager', c, line, { stage: 'REVIEW', revision: 7 }).expect(
      200,
    );
    e = await view(c);
    expect(e.deadlines[0]).toMatchObject({
      achievedAt: first,
      current: { result: 'ON_TIME' },
    });
    expect(e.timeline.map((t: { to: string }) => t.to)).toEqual([
      'FIELDWORK',
      'REVIEW',
      'FIELDWORK',
      'REVIEW',
    ]);
  });

  it('trễ hạn tính cho người giữ vai lúc hạn đến (F10); trợ lý không bị tính; lọc vai và loại hạn', async () => {
    // Dịch vụ riêng để lọc đúng số liệu của ca này.
    const service = await ctx.prisma.serviceType.create({
      data: { code: 'KT-F10', name: 'Kiểm toán F10', issuesAuditReport: true },
    });
    const only = `&serviceTypeId=${service.id}`;
    const { c, line } = await approvedLine(service.id);
    await save(c, line, {
      revision: 0,
      assistantIds: [id('cashier')],
      fieldworkDue: inDays(-3),
      reviewDue: inDays(-1),
      issueDue: inDays(30),
    }).expect(200);
    await backdateTeam(line);
    await stage('manager', c, line, { stage: 'FIELDWORK', revision: 1 }).expect(
      200,
    );
    // Đổi trưởng nhóm sau khi hạn kết thúc kiểm toán đã qua: người cũ vẫn chịu hạn đó.
    await save(c, line, {
      revision: 2,
      leadId: id('staff2'),
      assistantIds: [id('cashier')],
    }).expect(200);
    await stage('manager', c, line, { stage: 'REVIEW', revision: 3 }).expect(
      200,
    );

    const res = await people('director', only).expect(200);
    const row = (who: Who) =>
      res.body.items.find(
        (i: { user: { id: string } }) => i.user.id === id(who),
      );
    expect(row('staff')).toMatchObject({
      total: 1,
      late: 1,
      rate: 0,
      avgLateDays: 3,
    });
    expect(row('manager')).toMatchObject({
      total: 3,
      late: 1,
      overdue: 1,
      rate: 0,
      activeEngagements: 1,
    });
    expect(row('director')).toMatchObject({ total: 1, overdue: 1 });
    expect(row('staff2')).toMatchObject({ total: 1, rate: null });
    expect(row('cashier')).toBeUndefined();

    const leads = await people('director', `${only}&role=LEAD`).expect(200);
    expect(
      leads.body.items.map((i: { user: { id: string } }) => i.user.id).sort(),
    ).toEqual([id('staff'), id('staff2')].sort());
    const reviews = await people('director', `${only}&kind=REVIEW_END`).expect(
      200,
    );
    expect(
      reviews.body.items.map((i: { user: { id: string } }) => i.user.id).sort(),
    ).toEqual([id('director'), id('manager')].sort());

    const detail = await as('director')
      .get(
        `/contracts/audit-tracking/people/${id('staff')}?from=${inDays(-60)}&to=${inDays(90)}${only}`,
      )
      .expect(200);
    expect(detail.body.items).toEqual([
      expect.objectContaining({
        kind: 'FIELDWORK_END',
        roles: ['LEAD'],
        currentDue: inDays(-3),
        current: { result: 'LATE', days: 3 },
      }),
    ]);
  });

  it('phạm vi xem (F11): GĐ tất cả, KTT nhóm mình, nhân viên chỉ mình; thu tiền, quản trị 403', async () => {
    const ids = async (who: Who) =>
      (await people(who).expect(200)).body.items
        .map((i: { user: { id: string } }) => i.user.id)
        .sort();
    expect(await ids('manager')).toEqual([id('manager'), id('staff')].sort());
    expect(await ids('staff')).toEqual([id('staff')]);
    expect((await ids('director')).length).toBeGreaterThan(2);
    await people('cashier').expect(403);
    await people('admin').expect(403);
    await as('staff')
      .get(`/contracts/audit-tracking/people/${id('manager')}`)
      .expect(403);
    await as('staff')
      .get(
        `/contracts/audit-tracking/people/${id('staff')}?from=${inDays(-60)}&to=${inDays(90)}`,
      )
      .expect(200);
  });

  it('gia hạn cứu tỷ lệ theo hạn hiện hành nhưng không cứu tỷ lệ theo hạn gốc', async () => {
    const { c, line } = await approvedLine();
    await save(c, line, {
      revision: 0,
      signer1Id: id('director'),
      issueDue: inDays(-2),
    }).expect(200);
    await backdateTeam(line);
    await stage('director', c, line, {
      stage: 'FIELDWORK',
      revision: 1,
    }).expect(200);
    await extend('director', c, line, 'REPORT_ISSUE', {
      revision: 2,
      due: inDays(5),
      reason: 'Khách đổi số liệu cuối năm',
    }).expect(200);
    for (const [s, revision] of [
      ['REVIEW', 3],
      ['AWAITING_ISSUE', 4],
    ] as const)
      await stage('director', c, line, { stage: s, revision }).expect(200);
    await as('director')
      .post(`${base(c, line)}/issue`)
      .field('revision', '5')
      .field('reportNumber', `BC-${c.slice(0, 8)}`)
      .field('reportDate', inDays(0))
      .expect(200);
    const detail = await as('director')
      .get(
        `/contracts/audit-tracking/people/${id('manager')}?from=${inDays(-60)}&to=${inDays(90)}&kind=REPORT_ISSUE`,
      )
      .expect(200);
    const item = detail.body.items.find(
      (i: { contract: { id: string } }) => i.contract.id === c,
    );
    expect(item).toMatchObject({
      original: { result: 'LATE', days: 2 },
      current: { result: 'ON_TIME' },
      extensions: 1,
      extensionReasons: ['Khách đổi số liệu cuối năm'],
    });
  });

  it('người đang giữ vai nhưng chưa có hạn trong kỳ vẫn có một dòng, tỷ lệ "—" (review R4)', async () => {
    const service = await ctx.prisma.serviceType.create({
      data: { code: 'KT-R4', name: 'Kiểm toán R4', issuesAuditReport: true },
    });
    const { c, line } = await approvedLine(service.id);
    await save(c, line, { revision: 0 }).expect(200);
    const only = `&serviceTypeId=${service.id}`;
    const res = await people('director', only).expect(200);
    const row = (who: Who) =>
      res.body.items.find(
        (i: { user: { id: string } }) => i.user.id === id(who),
      );
    expect(row('manager')).toMatchObject({
      activeEngagements: 1,
      total: 0,
      rate: null,
    });
    expect(row('staff')).toMatchObject({
      activeEngagements: 1,
      total: 0,
      rate: null,
    });
    expect(row('cashier')).toBeUndefined();
    const leads = await people('director', `${only}&role=LEAD`).expect(200);
    expect(
      leads.body.items.map((i: { user: { id: string } }) => i.user.id),
    ).toEqual([id('staff')]);
    // Lọc loại hạn: chỉ vai chịu trách nhiệm loại hạn đó (soát xét → Manager, người ký 1).
    const reviews = await people('director', `${only}&kind=REVIEW_END`).expect(
      200,
    );
    expect(
      reviews.body.items.map((i: { user: { id: string } }) => i.user.id).sort(),
    ).toEqual([id('director'), id('manager')].sort());
  });
});
