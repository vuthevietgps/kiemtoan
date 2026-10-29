/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { addDays, todayVn } from '../src/modules/reports/utils/period.util';
import { collectPayment } from './utils/payments';
import { createTestContext, TestContext } from './utils/test-app';

const today = todayVn();
const day = (offset: number) =>
  addDays(today, offset).toISOString().slice(0, 10);

/**
 * 07-D2 (J10): đợt "N ngày sau phát hành BCKT" — chờ mốc thì không quá hạn; phát hành → hạn = ngày
 * phát hành + N; mở lại → về chờ mốc. Trạng thái thanh toán HĐ "Còn nợ quá hạn".
 * HĐ 1.650.000 đ: Đợt 1 600.000 đ hạn cố định 10 ngày trước (quá hạn); Đợt cuối 1.050.000 đ sau phát
 * hành BCKT 15 ngày (ngày dự kiến 30 ngày trước — không được tính quá hạn khi chưa phát hành).
 */
describe('07-D2 hạn theo phát hành BCKT (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let auditService: string;
  let otherService: string;
  let contractId: string;
  let lineId: string;
  let firstId: string;
  let finalId: string;
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);

  const services = (withAudit: boolean) => [
    ...(withAudit
      ? [
          {
            serviceTypeId: auditService,
            period: '2025',
            quantity: 1,
            unitPrice: '1000000',
          },
        ]
      : []),
    {
      serviceTypeId: otherService,
      period: '2026-01',
      quantity: 1,
      unitPrice: '500000',
    },
  ];
  const finalInstallment = {
    name: 'Đợt cuối',
    amount: '1050000',
    dueDate: day(-30),
    dueRule: 'AFTER_REPORT_ISSUE',
    dueOffsetDays: 15,
  };
  const detail = async () =>
    (await as('director').get(`/contracts/${contractId}`).expect(200)).body;
  const receivable = async () =>
    (
      await as('director')
        .get('/payments/receivables')
        .query({ customerId })
        .expect(200)
    ).body.items[0];
  const engagement = async () =>
    (
      await as('director')
        .get(`/contracts/${contractId}/audit-engagements`)
        .expect(200)
    ).body.engagements[0].engagement;
  const base = (installments: unknown[], withAudit = true) => ({
    customerId,
    startDate: day(-60),
    vatRate: 10,
    services: services(withAudit),
    installments,
  });

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
          name: 'Công ty Mốc BCKT',
          taxCode: '0100007501',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('chỉ chọn "sau phát hành BCKT" khi HĐ có dịch vụ phát hành BCKT và có số ngày 1–365', async () => {
    const res = await as('manager')
      .post('/contracts')
      .send(base([{ ...finalInstallment, amount: '550000' }], false))
      .expect(400);
    expect(res.body.message).toMatch(/phát hành báo cáo kiểm toán/);
    await as('manager')
      .post('/contracts')
      .send(
        base([
          { name: 'Đợt 1', amount: '600000', dueDate: day(-10) },
          { ...finalInstallment, dueOffsetDays: undefined },
        ]),
      )
      .expect(400);
  });

  it('chờ mốc: đợt cuối không quá hạn dù ngày dự kiến đã qua; HĐ "Còn nợ quá hạn" do đợt 1', async () => {
    const created = await as('manager')
      .post('/contracts')
      .send(
        base([
          { name: 'Đợt 1', amount: '600000', dueDate: day(-10) },
          finalInstallment,
        ]),
      )
      .expect(201);
    contractId = created.body.id;
    // HĐ Nháp chưa phát sinh công nợ: đợt đã qua hạn vẫn không tính "Còn nợ quá hạn" (J7, J12).
    expect(await detail()).toMatchObject({
      paymentStatus: 'UNPAID',
      overdueAmount: '0',
    });
    await as('manager').post(`/contracts/${contractId}/submit`).expect(200);
    await as('director').post(`/contracts/${contractId}/approve`).expect(200);
    lineId = (
      await ctx.prisma.contractService.findFirstOrThrow({
        where: { contractId, serviceTypeId: auditService },
      })
    ).id;
    const c = await detail();
    [firstId, finalId] = c.installments.map((i: { id: string }) => i.id);
    expect(c).toMatchObject({
      paymentStatus: 'OVERDUE',
      overdueAmount: '600000',
    });
    expect(c.installments[1]).toMatchObject({
      dueRule: 'AFTER_REPORT_ISSUE',
      dueOffsetDays: 15,
      milestoneDate: null,
      awaitingMilestone: true,
      overdueDays: null,
    });
    const r = await receivable();
    expect(r).toMatchObject({
      overdueAmount: '600000',
      aging: { notDue: '1050000', '0-30': '600000' },
    });
    // Công nợ xếp đợt theo hạn: đợt cuối (ngày dự kiến sớm hơn) đứng trước.
    expect(
      r.installments.find((i: { id: string }) => i.id === finalId),
    ).toMatchObject({
      id: finalId,
      awaitingMilestone: true,
      dueInDays: null,
    });
  });

  it('phát hành BCKT → hạn = ngày phát hành + 15 (quá hạn 5 ngày); mở lại → về chờ mốc', async () => {
    await as('manager')
      .put(`/contracts/${contractId}/audit-engagements/${lineId}`)
      .send({ revision: 0, issueDue: '2099-12-31' })
      .expect(200);
    for (const stage of ['FIELDWORK', 'REVIEW', 'AWAITING_ISSUE']) {
      const { revision } = await engagement();
      await as('manager')
        .post(`/contracts/${contractId}/audit-engagements/${lineId}/stage`)
        .send({ stage, revision })
        .expect(200);
    }
    const { revision } = await engagement();
    await as('director')
      .post(`/contracts/${contractId}/audit-engagements/${lineId}/issue`)
      .field('revision', String(revision))
      .field('reportNumber', '07D2/BCKT')
      .field('reportDate', day(-20))
      .field('signer1Id', ctx.users.director.id)
      .expect(200);
    let c = await detail();
    expect(c.installments[1]).toMatchObject({
      awaitingMilestone: false,
      overdueDays: 5,
    });
    expect(c.installments[1].dueDate.slice(0, 10)).toBe(day(-5));
    expect(c.installments[1].milestoneDate.slice(0, 10)).toBe(day(-20));
    expect(c.overdueAmount).toBe('1650000');
    expect((await receivable()).aging).toMatchObject({
      notDue: '0',
      '0-30': '1650000',
    });

    const issued = await engagement();
    await as('director')
      .post(`/contracts/${contractId}/audit-engagements/${lineId}/reopen`)
      .send({ revision: issued.revision, reason: 'Sửa số liệu BCKT' })
      .expect(200);
    c = await detail();
    expect(c.installments[1]).toMatchObject({
      awaitingMilestone: true,
      milestoneDate: null,
    });
    expect(c.overdueAmount).toBe('600000');
  });

  it('thu đủ đợt quá hạn → hết "Còn nợ quá hạn" (đợt cuối vẫn chờ mốc)', async () => {
    await collectPayment(ctx, {
      contractId,
      installmentId: firstId,
      amount: '600000',
      paidDate: day(0),
    });
    const c = await detail();
    expect(c).toMatchObject({ paymentStatus: 'PARTIAL', overdueAmount: '0' });
    const list = await as('director')
      .get('/contracts')
      .query({ search: c.code })
      .expect(200);
    expect(list.body.items[0].paymentStatus).toBe('PARTIAL');
  });
});
