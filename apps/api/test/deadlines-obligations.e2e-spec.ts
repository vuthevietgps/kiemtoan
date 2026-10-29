/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- res.body của supertest có kiểu any */
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTRACT_APPROVED,
  ContractApprovedEvent,
} from '../src/common/events/app-events';
import { todayVn } from '../src/modules/reports/utils/period.util';
import { confirmDefaultPlans } from './utils/plans';
import { createTestContext, TestContext } from './utils/test-app';

const PDF = Buffer.from('%PDF-1.4\nbien nhan nop to khai\n%%EOF');
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utc = (y: number, m0: number, day: number) =>
  new Date(Date.UTC(y, m0, day));
const nextWeekday = (date: Date) => {
  let current = date;
  while ([0, 6].includes(current.getUTCDay()))
    current = new Date(current.getTime() + 86_400_000);
  return current;
};

/**
 * 06-B: lịch làm việc theo năm, loại nghĩa vụ (nháp → xác nhận), lịch báo cáo theo KH khi HĐ duyệt,
 * việc bước pháp lý gắn nghĩa vụ, nộp kèm biên nhận, đồng bộ theo hồ sơ thuế, tính lại hạn (I8).
 * Quy tắc trong test là ví dụ cơ chế, không phải danh mục pháp lý đã xác nhận (QD07).
 */
describe('06-B lịch báo cáo và hạn pháp lý (e2e)', () => {
  let ctx: TestContext;
  let serviceId: string;
  let stepId: string;
  let customerA: string;
  let customerB: string;
  let contractA: string;
  let contractB: string;
  let typeId: string;
  const today = todayVn();
  // HĐ 4 tháng bắt đầu từ tháng sau: mọi kỳ đều chưa bắt đầu, chưa quá hạn.
  const start = utc(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
  const end = utc(start.getUTCFullYear(), start.getUTCMonth() + 4, 0);
  const periods = [0, 1, 2, 3].map((i) =>
    iso(utc(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).slice(0, 7),
  );
  // Ví dụ quy tắc: ngày 20 tháng sau kỳ, trùng cuối tuần → ngày làm việc kế tiếp.
  const expectedDue = (i: number) =>
    iso(
      nextWeekday(utc(start.getUTCFullYear(), start.getUTCMonth() + i + 1, 20)),
    );

  const api = (key: keyof TestContext['users']) => ctx.api(ctx.users[key]);
  const approve = async (contractId: string, withPlans = true) => {
    if (withPlans)
      await confirmDefaultPlans(ctx.prisma, contractId, ctx.users.director.id);
    const event: ContractApprovedEvent = {
      contractId,
      approvedById: ctx.users.director.id,
    };
    await ctx.app.get(EventEmitter2).emitAsync(CONTRACT_APPROVED, event);
  };
  const obligationsOf = (customerId: string) =>
    ctx.prisma.customerObligation.findMany({
      where: { customerId },
      orderBy: { period: 'asc' },
    });
  const taskOf = (period: string) =>
    ctx.prisma.task.findFirstOrThrow({
      where: { contractId: contractA, period },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    const service = await ctx.prisma.serviceType.create({
      data: { code: 'KTT', name: 'Kế toán thuế', cycle: 'MONTHLY' },
    });
    serviceId = service.id;
    const template = await ctx.prisma.workflowTemplate.create({
      data: {
        serviceTypeId: service.id,
        code: 'QT-KTT-001',
        name: 'Quy trình KTT',
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
    const step = await ctx.prisma.workflowStep.create({
      data: {
        versionId: version.id,
        stepKey: 'B01',
        sortOrder: 1,
        name: 'Nộp tờ khai GTGT',
        dueOffsetDays: 15,
        requiresEvidence: false,
        isStatutory: true,
      },
    });
    stepId = step.id;
    const customer = (name: string, taxCode: string) =>
      ctx.prisma.customer.create({
        data: {
          name,
          taxCode,
          ownerId: ctx.users.staff.id,
          taxPeriod: 'MONTHLY',
          vatMethod: 'DEDUCTION',
        },
      });
    customerA = (await customer('Công ty Lịch A', '0100006001')).id;
    customerB = (await customer('Công ty Lịch B', '0100006002')).id;
    const contract = (code: string, customerId: string) =>
      ctx.prisma.contract.create({
        data: {
          code,
          customerId,
          ownerId: ctx.users.manager.id,
          startDate: start,
          endDate: end,
          status: 'NOT_STARTED',
          services: {
            create: {
              serviceTypeId: service.id,
              period: periods[0],
              unitPrice: 1_000_000,
              amount: 4_000_000,
              assigneeId: ctx.users.staff.id,
            },
          },
        },
      });
    contractA = (await contract('HD-06-A', customerA)).id;
    contractB = (await contract('HD-06-B', customerB)).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('I2: lịch năm — xem khi đăng nhập, KTT soạn nháp, chỉ GĐ xác nhận; làm bù phải là cuối tuần', async () => {
    const year = start.getUTCFullYear() + 1;
    const view = await api('admin')
      .get(`/business-calendar/${year}`)
      .expect(200);
    expect(view.body).toMatchObject({ year, status: 'DRAFT', days: [] });
    const days = [
      { date: `${year}-01-01`, kind: 'DAY_OFF', name: 'Tết Dương lịch' },
    ];
    await api('staff')
      .put(`/business-calendar/${year}`)
      .send({ days })
      .expect(403);
    await api('cashier')
      .put(`/business-calendar/${year}`)
      .send({ days })
      .expect(403);
    const saved = await api('manager')
      .put(`/business-calendar/${year}`)
      .send({ days })
      .expect(200);
    expect(saved.body).toMatchObject({ status: 'DRAFT', revision: 1 });
    await api('manager')
      .put(`/business-calendar/${year}`)
      .send({ days, revision: 99 })
      .expect(409);
    const weekday = nextWeekday(utc(year, 2, 2));
    const bad = await api('manager')
      .put(`/business-calendar/${year}`)
      .send({
        revision: 1,
        days: [{ date: iso(weekday), kind: 'WORKDAY', name: 'Làm bù' }],
      })
      .expect(400);
    expect(bad.body.message).toContain('thứ 7 hoặc Chủ nhật');
    await api('manager')
      .put(`/business-calendar/${year}`)
      .send({
        revision: 1,
        days: [{ date: `${year + 1}-01-01`, kind: 'DAY_OFF', name: 'Sai năm' }],
      })
      .expect(400);
    await api('manager')
      .post(`/business-calendar/${year}/confirm`)
      .send({ revision: 1 })
      .expect(403);
  });

  it('I1: loại nghĩa vụ — KTT soạn, kiểm tra quy tắc, GĐ xác nhận một lần; gắn dịch vụ', async () => {
    const body = {
      code: 'gtgt-thang',
      name: 'Tờ khai GTGT tháng',
      family: 'GTGT',
      cycle: 'MONTHLY',
      effectiveFrom: iso(utc(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      dueRule: 'MONTH_AFTER_END',
      monthsAfter: 1,
      dueDay: 20,
      conditions: { taxPeriod: ['MONTHLY'] },
      legalBasis: 'Ví dụ để test — chưa xác nhận',
    };
    await api('staff').post('/obligation-types').send(body).expect(403);
    await api('cashier').get('/obligation-types').expect(403);
    await api('manager')
      .post('/obligation-types')
      .send({ ...body, dueDay: 32 })
      .expect(400);
    const fixedMonthly = await api('manager')
      .post('/obligation-types')
      .send({ ...body, dueRule: 'FIXED_IN_YEAR', dueMonth: 1 })
      .expect(400);
    expect(fixedMonthly.body.message).toContain('theo năm');
    const bad = await api('manager')
      .post('/obligation-types')
      .send({ ...body, conditions: { taxPeriod: ['YEARLY'] } })
      .expect(400);
    expect(bad.body.message).toContain('không hợp lệ');
    const created = await api('manager')
      .post('/obligation-types')
      .send(body)
      .expect(201);
    typeId = created.body.id;
    expect(created.body).toMatchObject({ code: 'GTGT-THANG', family: 'GTGT' });
    expect(created.body.versions[0]).toMatchObject({
      status: 'DRAFT',
      versionNo: 1,
      revision: 1,
    });
    await api('manager').post('/obligation-types').send(body).expect(409);
    // Sửa nháp đồng thời cùng revision: chỉ một lần thành công.
    const draft = {
      effectiveFrom: body.effectiveFrom,
      dueRule: body.dueRule,
      monthsAfter: body.monthsAfter,
      dueDay: body.dueDay,
      conditions: body.conditions,
      legalBasis: body.legalBasis,
      revision: 1,
    };
    const saves = await Promise.all([
      api('manager').put(`/obligation-types/${typeId}/draft`).send(draft),
      api('manager').put(`/obligation-types/${typeId}/draft`).send(draft),
    ]);
    expect(saves.map((r) => r.status).sort()).toEqual([200, 409]);
    await api('manager')
      .put(`/obligation-types/${typeId}/services`)
      .send({ serviceTypeIds: [serviceId] })
      .expect(200);
    await api('manager')
      .post(`/obligation-types/${typeId}/draft/confirm`)
      .send({ revision: 2 })
      .expect(403);
    const preview = await api('staff')
      .get(
        `/obligation-types/${typeId}/preview?customerId=${customerA}&periods=3`,
      )
      .expect(200);
    expect(preview.body).toMatchObject({ status: 'DRAFT', applies: true });
    expect(preview.body.periods).toHaveLength(3);
    // Chưa xác nhận → chưa sinh lịch báo cáo.
    await approve(contractB, false);
    expect(await obligationsOf(customerB)).toHaveLength(0);
    const confirms = await Promise.all([
      api('director')
        .post(`/obligation-types/${typeId}/draft/confirm`)
        .send({ revision: 2 }),
      api('director')
        .post(`/obligation-types/${typeId}/draft/confirm`)
        .send({ revision: 2 }),
    ]);
    expect(confirms.map((r) => r.status).sort()).toEqual([200, 409]);
    // Xác nhận đồng bộ: KH B có HĐ hiệu lực của dịch vụ gắn loại → 4 kỳ.
    const b = await obligationsOf(customerB);
    expect(b.map((o) => [o.period, iso(o.dueDate)])).toEqual(
      periods.map((p, i) => [p, expectedDue(i)]),
    );
  });

  it('I4/I6: HĐ duyệt sinh lịch báo cáo, việc bước pháp lý gắn nghĩa vụ và nhận hạn pháp lý; gọi lại không trùng', async () => {
    await ctx.prisma.workflowStep.update({
      where: { id: stepId },
      data: { obligationTypeId: typeId },
    });
    await approve(contractA);
    await approve(contractA);
    const obligations = await obligationsOf(customerA);
    expect(obligations).toHaveLength(4);
    const tasks = await ctx.prisma.task.findMany({
      where: { contractId: contractA },
      orderBy: { period: 'asc' },
    });
    expect(tasks).toHaveLength(4);
    tasks.forEach((t, i) => {
      expect(t.obligationId).toBe(obligations[i].id);
      expect(iso(t.dueDate)).toBe(expectedDue(i));
      expect(iso(t.originalDueDate)).toBe(expectedDue(i));
    });
    const staffList = await api('staff')
      .get(`/customer-obligations?customerId=${customerA}`)
      .expect(200);
    expect(staffList.body.total).toBe(4);
    expect(staffList.body.items[0]).toMatchObject({
      displayStatus: 'NOT_DUE',
      dueDate: expectedDue(0),
      obligationType: { code: 'GTGT-THANG' },
    });
    expect(staffList.body.items[0].tasks).toHaveLength(1);
    const other = await api('staff2').get('/customer-obligations').expect(200);
    expect(other.body.total).toBe(0);
    await api('staff2')
      .get(`/customer-obligations/${obligations[0].id}`)
      .expect(404);
    await api('cashier').get('/customer-obligations').expect(403);
    await api('admin').get('/customer-obligations').expect(403);
    const overdue = await api('director')
      .get('/customer-obligations?status=OVERDUE')
      .expect(200);
    expect(overdue.body.total).toBe(0);
  });

  it('I6/I7: việc gắn bắt đầu → Đang chuẩn bị; hoàn thành có file → Đã nộp kèm biên nhận; thiếu file giữ Đang chuẩn bị', async () => {
    const [first, second] = await obligationsOf(customerA);
    const t1 = await taskOf(periods[0]);
    await api('staff').post(`/tasks/${t1.id}/start`).expect(200);
    expect(
      (
        await ctx.prisma.customerObligation.findUniqueOrThrow({
          where: { id: first.id },
        })
      ).status,
    ).toBe('PREPARING');
    const evidence = await api('staff')
      .post(`/tasks/${t1.id}/evidence`)
      .field('note', 'Biên nhận tờ khai')
      .attach('file', PDF, 'bien-nhan.pdf')
      .expect(201);
    await api('staff').post(`/tasks/${t1.id}/complete`).send({}).expect(200);
    const filed = await ctx.prisma.customerObligation.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(filed).toMatchObject({
      status: 'FILED',
      receiptDocumentId: evidence.body.id,
      filedLate: false,
      filedById: ctx.users.staff.id,
    });
    const t2 = await taskOf(periods[1]);
    await api('staff').post(`/tasks/${t2.id}/start`).expect(200);
    await api('staff').post(`/tasks/${t2.id}/complete`).send({}).expect(200);
    const detail = await api('staff')
      .get(`/customer-obligations/${second.id}`)
      .expect(200);
    expect(detail.body.status).toBe('PREPARING');
    expect(detail.body.events.at(-1).note).toContain('chưa có file biên nhận');
    expect(detail.body.events[0]).toMatchObject({
      toStatus: 'NOT_DUE',
      note: 'Sinh theo lịch pháp lý',
    });
  });

  it('I7: đánh dấu Đã nộp cần biên nhận và ngày hợp lệ; revision cũ 409; mở lại chỉ GĐ', async () => {
    const third = (await obligationsOf(customerA))[2];
    const url = `/customer-obligations/${third.id}`;
    await api('staff')
      .post(`${url}/file`)
      .field('revision', '1')
      .field('filedAt', iso(today))
      .expect(400);
    const tomorrow = iso(new Date(today.getTime() + 86_400_000));
    await api('staff')
      .post(`${url}/file`)
      .field('revision', '1')
      .field('filedAt', tomorrow)
      .attach('file', PDF, 'bien-nhan.pdf')
      .expect(400);
    await api('staff2')
      .post(`${url}/file`)
      .field('revision', '1')
      .field('filedAt', iso(today))
      .attach('file', PDF, 'bien-nhan.pdf')
      .expect(404);
    const ok = await api('staff')
      .post(`${url}/file`)
      .field('revision', '1')
      .field('filedAt', iso(today))
      .field('note', 'Nộp sớm')
      .attach('file', PDF, 'bien-nhan.pdf')
      .expect(200);
    expect(ok.body).toMatchObject({
      status: 'FILED',
      displayStatus: 'FILED',
      filedAt: iso(today),
    });
    const receipt = await ctx.prisma.document.findUniqueOrThrow({
      where: { id: ok.body.receiptDocument.id },
    });
    expect(receipt).toMatchObject({
      category: 'SERVICE',
      period: periods[2],
      customerId: customerA,
    });
    await api('staff')
      .post(`${url}/file`)
      .field('revision', '1')
      .field('filedAt', iso(today))
      .attach('file', PDF, 'bien-nhan.pdf')
      .expect(409);
    await api('manager')
      .post(`${url}/reopen`)
      .send({ revision: 2, reason: 'Nộp bổ sung tờ khai' })
      .expect(403);
    await api('director')
      .post(`${url}/reopen`)
      .send({ revision: 2, reason: 'ngắn' })
      .expect(400);
    const reopened = await api('director')
      .post(`${url}/reopen`)
      .send({ revision: 2, reason: 'Nộp bổ sung tờ khai' })
      .expect(200);
    expect(reopened.body).toMatchObject({ status: 'PREPARING', filedAt: null });
  });

  it('I5/I4: đổi kỳ khai làm kỳ chưa bắt đầu không còn áp dụng rồi áp dụng lại; bật/tắt riêng có lý do', async () => {
    await api('manager')
      .patch(`/customers/${customerB}`)
      .send({ taxPeriod: 'QUARTERLY' })
      .expect(200);
    expect((await obligationsOf(customerB)).map((o) => o.status)).toEqual(
      Array(4).fill('NOT_APPLICABLE'),
    );
    await api('manager')
      .patch(`/customers/${customerB}`)
      .send({ taxPeriod: 'MONTHLY' })
      .expect(200);
    expect((await obligationsOf(customerB)).map((o) => o.status)).toEqual(
      Array(4).fill('NOT_DUE'),
    );
    await api('manager')
      .patch(`/customers/${customerB}`)
      .send({ fiscalYearEndMonth: 13 })
      .expect(400);
    const url = `/customers/${customerB}/obligation-settings/${typeId}`;
    await api('staff')
      .put(url)
      .send({ enabled: false, reason: 'ngắn' })
      .expect(400);
    await api('staff2')
      .put(url)
      .send({ enabled: false, reason: 'KH tự nộp tờ khai' })
      .expect(404);
    const off = await api('staff')
      .put(url)
      .send({ enabled: false, reason: 'KH tự nộp tờ khai' })
      .expect(200);
    expect(off.body.synced.retired).toBe(4);
    expect(off.body.settings[0]).toMatchObject({
      code: 'GTGT-THANG',
      byService: true,
      setting: { enabled: false },
    });
    // Không áp dụng tay không bị đồng bộ mở lại.
    await api('staff')
      .put(url)
      .send({ enabled: true, reason: 'KH nhờ nộp lại' })
      .expect(200);
    const first = (await obligationsOf(customerB))[0];
    await api('staff')
      .post(`/customer-obligations/${first.id}/not-applicable`)
      .send({
        revision: first.revision,
        reason: 'Kỳ này KH tạm ngừng kinh doanh',
      })
      .expect(200);
    await api('manager')
      .patch(`/customers/${customerB}`)
      .send({ vatMethod: 'DEDUCTION', taxAuthority: 'Chi cục Thuế khu vực I' })
      .expect(200);
    expect((await obligationsOf(customerB))[0]).toMatchObject({
      status: 'NOT_APPLICABLE',
      manuallyExcluded: true,
    });
  });

  it('I8: xác nhận/sửa lịch năm dời hạn nghĩa vụ chưa tới và việc gắn chưa hoàn thành, không tính là gia hạn', async () => {
    const fourth = (await obligationsOf(customerA))[3];
    const due = fourth.dueDate;
    const year = due.getUTCFullYear();
    const shifted = iso(nextWeekday(new Date(due.getTime() + 86_400_000)));
    const days = [
      { date: iso(due), kind: 'DAY_OFF', name: 'Ngày nghỉ giả định để test' },
    ];
    const current = await api('director')
      .get(`/business-calendar/${year}`)
      .expect(200);
    const saved = await api('director')
      .put(`/business-calendar/${year}`)
      .send({
        days,
        ...(current.body.revision && { revision: current.body.revision }),
      })
      .expect(200);
    expect(saved.body.changedDues).toBe(0);
    const confirmed = await api('director')
      .post(`/business-calendar/${year}/confirm`)
      .send({ revision: saved.body.revision })
      .expect(200);
    expect(confirmed.body.status).toBe('CONFIRMED');
    expect(confirmed.body.changedDues).toBeGreaterThanOrEqual(1);
    const moved = await ctx.prisma.customerObligation.findUniqueOrThrow({
      where: { id: fourth.id },
    });
    expect(iso(moved.dueDate)).toBe(shifted);
    expect(iso(moved.originalDueDate)).toBe(iso(due));
    const task = await taskOf(periods[3]);
    expect(iso(task.dueDate)).toBe(shifted);
    expect(iso(task.originalDueDate)).toBe(iso(due));
    const change = await ctx.prisma.taskDueChange.findFirstOrThrow({
      where: { taskId: task.id },
    });
    expect(change).toMatchObject({
      calendarAdjusted: true,
      documented: false,
      status: 'APPROVED',
    });
    expect(
      await ctx.prisma.notification.count({
        where: {
          userId: ctx.users.staff.id,
          title: { contains: 'Hạn pháp lý đổi theo lịch mới' },
        },
      }),
    ).toBeGreaterThanOrEqual(1);
    // Việc đã hoàn thành không bị đổi hạn.
    expect(iso((await taskOf(periods[0])).dueDate)).toBe(expectedDue(0));
    // Sửa năm đã xác nhận: chỉ GĐ, bắt buộc lý do; bỏ ngày nghỉ → hạn trở lại.
    const rev = confirmed.body.revision;
    await api('manager')
      .put(`/business-calendar/${year}`)
      .send({ days: [], revision: rev })
      .expect(403);
    await api('director')
      .put(`/business-calendar/${year}`)
      .send({ days: [], revision: rev })
      .expect(400);
    const reverted = await api('director')
      .put(`/business-calendar/${year}`)
      .send({ days: [], revision: rev, reason: 'Nhập nhầm ngày nghỉ' })
      .expect(200);
    expect(reverted.body.changedDues).toBeGreaterThanOrEqual(1);
    expect(iso((await taskOf(periods[3])).dueDate)).toBe(iso(due));
    const log = await ctx.prisma.auditLog.findFirst({
      where: {
        action: 'CALENDAR_SAVE',
        detail: { path: ['reason'], equals: 'Nhập nhầm ngày nghỉ' },
      },
    });
    expect(log).not.toBeNull();
  });
});
