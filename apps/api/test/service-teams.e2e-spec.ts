/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- res.body của supertest có kiểu any */
import { createTestContext, TestContext } from './utils/test-app';

/** Nhóm thực hiện dòng dịch vụ kế toán (đặc tả 05, H8/G1) và vai Manager dòng trên công việc. */
describe('05-B nhóm dòng dịch vụ kế toán (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let contractId: string;
  let lineId: string;
  let auditLineId: string;
  let inactiveUser: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const id = (who: keyof TestContext['users']) => ctx.users[who].id;
  const url = (line: string) =>
    `/contracts/${contractId}/services/${line}/team`;
  const task = (contractServiceId: string) =>
    ctx.prisma.task.create({
      data: {
        customerId,
        contractId,
        contractServiceId,
        title: 'Việc của dòng',
        dueDate: new Date('2026-12-31'),
        originalDueDate: new Date('2026-12-31'),
        assigneeId: id('staff'),
      },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    const accounting = await ctx.prisma.serviceType.create({
      data: { code: 'KTDV', name: 'Kế toán dịch vụ' },
    });
    const audit = await ctx.prisma.serviceType.create({
      data: { code: 'KTBC', name: 'Kiểm toán BCTC', issuesAuditReport: true },
    });
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Nhóm Dịch Vụ',
          taxCode: '0100000777',
          ownerId: id('staff'),
        },
      })
    ).id;
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-NHOM-01',
        customerId,
        ownerId: id('manager'),
        startDate: new Date('2026-01-01'),
        status: 'IN_PROGRESS',
        services: {
          create: [
            {
              serviceTypeId: accounting.id,
              period: '2026-01',
              unitPrice: 1_000_000,
              amount: 1_000_000,
            },
            {
              serviceTypeId: audit.id,
              period: '2025',
              unitPrice: 2_000_000,
              amount: 2_000_000,
            },
          ],
        },
      },
      include: { services: true },
    });
    contractId = contract.id;
    lineId = contract.services.find(
      (s) => s.serviceTypeId === accounting.id,
    )!.id;
    auditLineId = contract.services.find(
      (s) => s.serviceTypeId === audit.id,
    )!.id;
    inactiveUser = (
      await ctx.prisma.user.create({
        data: {
          email: 'nghi-nhom@test.vn',
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

  it('nhân viên xem được, không sửa được nhóm (contracts:plan)', async () => {
    const res = await as('staff').get(url(lineId)).expect(200);
    expect(res.body).toEqual({
      lineId,
      revision: 0,
      manager: null,
      lead: null,
      assistants: [],
    });
    await as('staff')
      .put(url(lineId))
      .send({ revision: 0, managerId: id('staff') })
      .expect(403);
  });

  it('dòng kiểm toán dùng nhóm 04-F (400); trùng vai, người đã nghỉ → 400', async () => {
    await as('manager')
      .put(url(auditLineId))
      .send({ revision: 0, managerId: id('manager') })
      .expect(400);
    const dup = await as('manager')
      .put(url(lineId))
      .send({ revision: 0, managerId: id('manager'), leadId: id('manager') })
      .expect(400);
    expect(dup.body.message).toBe(
      'Một người không giữ hai vai trong cùng nhóm thực hiện',
    );
    await as('manager')
      .put(url(lineId))
      .send({ revision: 0, assistantIds: [inactiveUser] })
      .expect(400);
  });

  it('lưu nhóm, ghi lịch sử vai; revision cũ → 409', async () => {
    const res = await as('manager')
      .put(url(lineId))
      .send({
        revision: 0,
        managerId: id('manager'),
        leadId: id('staff'),
        assistantIds: [id('staff2')],
      })
      .expect(200);
    expect(res.body).toMatchObject({
      revision: 1,
      manager: { id: id('manager') },
      lead: { id: id('staff') },
      assistants: [{ id: id('staff2') }],
    });
    await as('manager')
      .put(url(lineId))
      .send({ revision: 0, managerId: id('director') })
      .expect(409);
    await as('director')
      .put(url(lineId))
      .send({
        revision: 1,
        managerId: id('manager'),
        leadId: id('staff2'),
        assistantIds: [],
      })
      .expect(200);
    const history = await ctx.prisma.serviceTeamRoleHistory.findMany({
      where: { team: { contractServiceId: lineId } },
      orderBy: { fromAt: 'asc' },
    });
    const open = history
      .filter((h) => !h.toAt)
      .map((h) => `${h.role}:${h.userId}`);
    expect(open.sort()).toEqual(
      [`LEAD:${id('staff2')}`, `MANAGER:${id('manager')}`].sort(),
    );
    expect(history.filter((h) => h.toAt)).toHaveLength(2);
    const contractHistory = await as('director')
      .get(`/contracts/${contractId}/history`)
      .expect(200);
    const actions = (contractHistory.body.items as { action: string }[]).map(
      (i) => i.action,
    );
    expect(actions.filter((a) => a === 'SERVICE_TEAM_UPDATE')).toHaveLength(2);
    expect(actions).not.toContain('UPDATE');
  });

  it('G1: Manager của dòng quản lý được việc của dòng dù không có tasks:approve', async () => {
    const t = await task(lineId);
    await as('staff')
      .patch(`/tasks/${t.id}`)
      .send({ priority: 'HIGH' })
      .expect(403);
    const { revision } = (await as('staff').get(url(lineId)).expect(200)).body;
    await as('manager')
      .put(url(lineId))
      .send({ revision, managerId: id('staff') })
      .expect(200);
    const res = await as('staff')
      .patch(`/tasks/${t.id}`)
      .send({ priority: 'HIGH' })
      .expect(200);
    expect(res.body.priority).toBe('HIGH');
  });

  it('dòng kiểm toán: Manager của nhóm 04-F là người quản lý việc', async () => {
    const t = await task(auditLineId);
    await as('staff')
      .patch(`/tasks/${t.id}`)
      .send({ priority: 'URGENT' })
      .expect(403);
    await ctx.prisma.auditEngagement.create({
      data: { contractServiceId: auditLineId, managerId: id('staff') },
    });
    await as('staff')
      .patch(`/tasks/${t.id}`)
      .send({ priority: 'URGENT' })
      .expect(200);
  });
});
