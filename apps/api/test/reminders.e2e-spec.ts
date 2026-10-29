/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { TaskStatus } from '@prisma/client';
import { NotificationMailer } from '../src/modules/notifications/notification-mailer';
import { ReminderService } from '../src/modules/notifications/reminder.service';
import { createTestContext, TestContext } from './utils/test-app';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
// Thứ 4 10/03/2027, 08:00 giờ VN (năm 2027 chưa xác nhận lịch → thứ 2–6).
const NOW = new Date('2027-03-10T01:00:00Z');
const minutes = (base: Date, m: number) =>
  new Date(base.getTime() + m * 60_000);

/**
 * 06-C: nhắc theo mốc (I9), leo thang quá hạn, SLA soát xét và bản tin sáng (I13), kênh email và tuỳ
 * chọn cá nhân (I10), chống gửi trùng/chạy song song, thử lại và huỷ mốc cũ (I12).
 */
describe('06-C nhắc việc theo lịch (e2e)', () => {
  let ctx: TestContext;
  let reminders: ReminderService;
  let mailer: NotificationMailer;
  let customerId: string;
  const ids: Record<string, string> = {};

  const task = async (
    key: string,
    due: string,
    patch: Partial<{
      status: TaskStatus;
      reviewerId: string;
      reviewLevel: number;
    }> = {},
  ) => {
    const t = await ctx.prisma.task.create({
      data: {
        customerId,
        title: `Việc ${key}`,
        dueDate: d(due),
        originalDueDate: d(due),
        assigneeId: ctx.users.staff.id,
        ...patch,
      },
    });
    ids[key] = t.id;
    return t;
  };
  const deliveries = (subjectId: string) =>
    ctx.prisma.notificationDelivery.findMany({
      where: { subjectId },
      orderBy: [{ milestone: 'asc' }, { channel: 'asc' }],
    });
  const notifCount = () => ctx.prisma.notification.count();

  beforeAll(async () => {
    ctx = await createTestContext();
    reminders = ctx.app.get(ReminderService);
    mailer = ctx.app.get(NotificationMailer);
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Nhắc',
          taxCode: '0100007001',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    await ctx.prisma.customerAssignment.create({
      data: {
        customerId,
        userId: ctx.users.manager.id,
        assignedById: ctx.users.director.id,
      },
    });
    await task('D7', '2027-03-17');
    await task('D1', '2027-03-11');
    await task('D0', '2027-03-10');
    await task('LATE1', '2027-03-09');
    await task('LATE4', '2027-03-04');
    await task('REVIEW', '2027-04-30', {
      status: TaskStatus.IN_REVIEW,
      reviewerId: ctx.users.manager.id,
      reviewLevel: 1,
    });
    await ctx.prisma.taskStatusEvent.create({
      data: {
        taskId: ids.REVIEW,
        toStatus: TaskStatus.IN_REVIEW,
        occurredAt: new Date('2027-03-03T02:00:00Z'),
      },
    });
    await task('HOLD', '2027-03-10', { status: TaskStatus.ON_HOLD });
    await task('DONE', '2027-03-10', { status: TaskStatus.COMPLETED });
    const type = await ctx.prisma.obligationType.create({
      data: {
        code: 'VD-NHAC',
        name: 'Tờ khai ví dụ',
        family: 'VD-NHAC',
        cycle: 'MONTHLY',
        versions: {
          create: {
            versionNo: 1,
            status: 'CONFIRMED',
            effectiveFrom: d('2027-01-01'),
            dueRule: 'MONTH_AFTER_END',
            monthsAfter: 1,
            dueDay: 11,
          },
        },
      },
      include: { versions: true },
    });
    ids.OBL = (
      await ctx.prisma.customerObligation.create({
        data: {
          customerId,
          obligationTypeId: type.id,
          versionId: type.versions[0].id,
          period: '2027-02',
          periodEnd: d('2027-02-28'),
          dueDate: d('2027-03-11'),
          originalDueDate: d('2027-03-11'),
        },
      })
    ).id;
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await ctx.app.close();
  });

  it('trước giờ gửi 07:30 không nhắc gì', async () => {
    const r = await reminders.runOnce(new Date('2027-03-10T00:00:00Z'));
    expect(r).toMatchObject({ skipped: false, planned: 0, inApp: 0 });
    expect(await notifCount()).toBe(0);
  });

  it('I9/I10/I13: mốc đúng người, đúng kênh; leo thang, SLA, bản tin; chạy lại không trùng', async () => {
    const r = await reminders.runOnce(NOW);
    expect(r.skipped).toBe(false);
    const view = async (key: string) =>
      (await deliveries(ids[key]))
        .map((x) => [x.milestone, x.channel, x.userId, x.status])
        .sort((a, b) => `${a[0]}|${a[1]}`.localeCompare(`${b[0]}|${b[1]}`));
    const { staff, manager } = ctx.users;
    expect(await view('D7')).toEqual([['D-7', 'IN_APP', staff.id, 'SENT']]);
    expect(await view('D1')).toEqual([
      ['D-1', 'EMAIL', staff.id, 'SKIPPED'],
      ['D-1', 'IN_APP', staff.id, 'SENT'],
    ]);
    expect((await view('D0')).map((x) => x[0])).toEqual(['D0', 'D0']);
    expect((await view('LATE1')).map((x) => x[0])).toEqual(['D+1', 'D+1']);
    // Quá hạn 4 ngày: nhắc quá hạn (gửi bù trong 7 ngày) + leo thang sau 3 ngày làm việc tới KTT phụ trách.
    expect(await view('LATE4')).toEqual([
      ['D+1', 'EMAIL', staff.id, 'SKIPPED'],
      ['D+1', 'IN_APP', staff.id, 'SENT'],
      ['ESC', 'EMAIL', manager.id, 'SKIPPED'],
      ['ESC', 'IN_APP', manager.id, 'SENT'],
    ]);
    // Chờ kiểm tra 5 ngày làm việc: nhắc người kiểm tra + báo quản lý.
    expect((await view('REVIEW')).map((x) => [x[0], x[2]])).toEqual([
      ['SLA-ESC-L1', manager.id],
      ['SLA-ESC-L1', manager.id],
      ['SLA-L1', manager.id],
      ['SLA-L1', manager.id],
    ]);
    expect(await view('HOLD')).toEqual([]);
    expect(await view('DONE')).toEqual([]);
    expect((await view('OBL')).map((x) => [x[0], x[2]])).toEqual([
      ['D-1', staff.id],
      ['D-1', staff.id],
    ]);
    const overdue = await ctx.prisma.notification.findFirstOrThrow({
      where: { subjectId: ids.LATE1 },
    });
    expect(overdue).toMatchObject({
      kind: 'OVERDUE',
      severity: 'DANGER',
      link: `/tasks?id=${ids.LATE1}`,
    });
    expect(overdue.title).toContain(
      'Quá hạn: Việc LATE1 — Công ty Nhắc, hạn 09/03/2027',
    );
    const digests = await ctx.prisma.notification.findMany({
      where: { kind: 'DIGEST' },
    });
    expect(digests.map((n) => n.userId).sort()).toEqual(
      [staff.id, manager.id].sort(),
    );
    expect(digests.find((n) => n.userId === staff.id)!.title).toContain(
      '1 việc hôm nay, 2 quá hạn, 0 chờ soát xét, 1 báo cáo sắp hạn',
    );
    expect(r.emails.skipped).toBe(r.emailsQueued);
    const before = await notifCount();
    const again = await reminders.runOnce(minutes(NOW, 15));
    expect(again).toMatchObject({ inApp: 0, emailsQueued: 0 });
    expect(await notifCount()).toBe(before);
  });

  it('I12: hai lượt chạy song song không gửi trùng', async () => {
    const next = new Date('2027-03-11T01:00:00Z');
    const before = await notifCount();
    const runs = await Promise.all([
      reminders.runOnce(next),
      reminders.runOnce(next),
    ]);
    const created = runs.reduce((sum, r) => sum + r.inApp, 0);
    expect(created).toBeGreaterThan(0);
    expect(await notifCount()).toBe(before + created);
    const dup = await ctx.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM (
        SELECT subject_id, milestone, due_key, channel, user_id FROM notification_deliveries
        GROUP BY 1, 2, 3, 4, 5 HAVING count(*) > 1) x`;
    expect(Number(dup[0].n)).toBe(0);
  });

  it('I12: email lỗi thử lại theo lịch rồi Thất bại; gửi lại thủ công; đổi hạn huỷ email chờ', async () => {
    jest.spyOn(mailer, 'isConfigured').mockReturnValue(true);
    const send = jest
      .spyOn(mailer, 'send')
      .mockRejectedValue(new Error('SMTP down'));
    const base = new Date('2027-03-15T01:00:00Z');
    await task('MAIL', '2027-03-16');
    await reminders.runOnce(base);
    const email = () =>
      ctx.prisma.notificationDelivery.findFirstOrThrow({
        where: { subjectId: ids.MAIL, channel: 'EMAIL' },
      });
    expect(await email()).toMatchObject({
      status: 'PENDING',
      attempts: 1,
      lastError: 'SMTP down',
    });
    let at = base;
    for (const wait of [1, 5, 15, 60]) {
      at = minutes(at, wait);
      await reminders.sendEmails(at);
    }
    expect(await email()).toMatchObject({ status: 'FAILED', attempts: 5 });
    const failed = await email();
    await ctx
      .api(ctx.users.staff)
      .post(`/notification-deliveries/${failed.id}/retry`)
      .expect(403);
    await ctx
      .api(ctx.users.director)
      .post(`/notification-deliveries/${failed.id}/retry`)
      .expect(200);
    send.mockResolvedValue(undefined);
    await reminders.sendEmails(minutes(at, 1));
    expect(await email()).toMatchObject({ status: 'SENT', attempts: 1 });
    expect(send).toHaveBeenCalledWith(
      'staff@test.vn',
      expect.stringContaining('Gần đến hạn (còn 1 ngày): Việc MAIL'),
      expect.stringContaining(`/tasks?id=${ids.MAIL}`),
    );
    // Email chờ thử lại của việc đổi hạn → Huỷ, không gửi nữa.
    send.mockRejectedValue(new Error('SMTP down'));
    await task('MOVE', '2027-03-16');
    await reminders.runOnce(minutes(base, 30));
    await ctx.prisma.task.update({
      where: { id: ids.MOVE },
      data: { dueDate: d('2027-03-30') },
    });
    await reminders.runOnce(minutes(base, 45));
    const moved = await ctx.prisma.notificationDelivery.findFirstOrThrow({
      where: { subjectId: ids.MOVE, channel: 'EMAIL' },
    });
    expect(moved.status).toBe('CANCELLED');
    const list = await ctx
      .api(ctx.users.admin)
      .get('/notification-deliveries?status=FAILED')
      .expect(200);
    expect(
      list.body.items.every((x: { status: string }) => x.status === 'FAILED'),
    ).toBe(true);
    await ctx.api(ctx.users.staff).get('/notification-deliveries').expect(403);
  });

  it('I10: tắt email chỉ còn thông báo trong ứng dụng; tắt bản tin thì không nhận bản tin', async () => {
    const api = ctx.api(ctx.users.staff);
    expect(
      (await api.get('/notifications/preferences').expect(200)).body,
    ).toEqual({
      emailEnabled: true,
      digestEnabled: true,
    });
    await api
      .put('/notifications/preferences')
      .send({ emailEnabled: 'x' })
      .expect(400);
    await api
      .put('/notifications/preferences')
      .send({ emailEnabled: false, digestEnabled: false })
      .expect(200);
    await task('NOMAIL', '2027-03-19');
    await reminders.runOnce(new Date('2027-03-18T01:00:00Z'));
    expect((await deliveries(ids.NOMAIL)).map((x) => x.channel)).toEqual([
      'IN_APP',
    ]);
    const digestToday = await ctx.prisma.notificationDelivery.count({
      where: {
        milestone: 'DIGEST',
        userId: ctx.users.staff.id,
        dueKey: d('2027-03-18'),
      },
    });
    expect(digestToday).toBe(0);
  });

  it('I11: cấu hình mốc/ngưỡng chỉ người có quyền cài đặt; ngưỡng dịch vụ đổi mức gấp trên danh sách việc', async () => {
    await ctx.api(ctx.users.staff).get('/reminder-settings').expect(403);
    await ctx
      .api(ctx.users.manager)
      .put('/reminder-settings')
      .send({})
      .expect(403);
    const current = (
      await ctx.api(ctx.users.admin).get('/reminder-settings').expect(200)
    ).body;
    expect(current).toMatchObject({
      thresholds: [7, 3, 1],
      sendTime: '07:30',
      escalationWorkingDays: 3,
    });
    const body = {
      revision: current.revision,
      thresholds: [3, 7, 1],
      sendTime: '07:30',
      escalationWorkingDays: 3,
    };
    await ctx
      .api(ctx.users.director)
      .put('/reminder-settings')
      .send(body)
      .expect(400);
    await ctx
      .api(ctx.users.director)
      .put('/reminder-settings')
      .send({ ...body, sendTime: '7h' })
      .expect(400);
    await ctx
      .api(ctx.users.director)
      .put('/reminder-settings')
      .send({ ...body, thresholds: [10, 5, 2] })
      .expect(200);
    await ctx
      .api(ctx.users.director)
      .put('/reminder-settings')
      .send({ ...body, thresholds: [10, 5, 2] })
      .expect(409);

    const service = await ctx.prisma.serviceType.create({
      data: { code: 'QT-NAM', name: 'Quyết toán năm', cycle: 'YEARLY' },
    });
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-NHAC',
        customerId,
        ownerId: ctx.users.director.id,
        startDate: d('2026-01-01'),
        status: 'IN_PROGRESS',
        services: {
          create: { serviceTypeId: service.id, unitPrice: 1, amount: 1 },
        },
      },
      include: { services: true },
    });
    const today = new Date();
    const in12 = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() + 12,
      ),
    );
    const t = await ctx.prisma.task.create({
      data: {
        customerId,
        contractId: contract.id,
        contractServiceId: contract.services[0].id,
        title: 'Quyết toán TNDN',
        dueDate: in12,
        originalDueDate: in12,
        assigneeId: ctx.users.staff.id,
      },
    });
    const urgency = async () =>
      (await ctx.api(ctx.users.staff).get(`/tasks/${t.id}`).expect(200)).body
        .urgency;
    expect(await urgency()).toBe('NORMAL');
    await ctx
      .api(ctx.users.staff)
      .put(`/service-urgency-thresholds/${service.id}`)
      .send({ thresholds: [15, 7, 3] })
      .expect(403);
    await ctx
      .api(ctx.users.director)
      .put(`/service-urgency-thresholds/${service.id}`)
      .send({ thresholds: [15, 7] })
      .expect(400);
    await ctx
      .api(ctx.users.director)
      .put(`/service-urgency-thresholds/${service.id}`)
      .send({ thresholds: [15, 7, 3] })
      .expect(200);
    expect(await urgency()).toBe('DUE_SOON');
    const list = await ctx
      .api(ctx.users.staff)
      .get('/tasks/my?tab=upcoming')
      .expect(200);
    expect(
      list.body.items.every(
        (x: { urgency: string | null }) => x.urgency !== undefined,
      ),
    ).toBe(true);
    await ctx
      .api(ctx.users.director)
      .delete(`/service-urgency-thresholds/${service.id}`)
      .expect(200);
    expect(await urgency()).toBe('NORMAL');
    const log = await ctx.prisma.auditLog.findFirst({
      where: { action: 'REMINDER_SETTINGS' },
    });
    expect(log?.detail).toMatchObject({
      before: { thresholds: [7, 3, 1] },
      after: { thresholds: [10, 5, 2] },
    });
  });

  it('I13: ngày nghỉ của năm đã xác nhận không gửi bản tin sáng', async () => {
    await ctx.prisma.businessCalendarYear.create({
      data: {
        year: 2027,
        status: 'CONFIRMED',
        days: {
          create: {
            date: d('2027-03-22'),
            kind: 'DAY_OFF',
            name: 'Ngày nghỉ giả định để test',
          },
        },
      },
    });
    await task('HOLIDAY', '2027-03-22', { reviewerId: ctx.users.manager.id });
    await reminders.runOnce(new Date('2027-03-22T01:00:00Z'));
    expect(
      await ctx.prisma.notificationDelivery.count({
        where: { milestone: 'DIGEST', dueKey: d('2027-03-22') },
      }),
    ).toBe(0);
    // Nhắc hạn vẫn gửi (việc hạn đúng ngày nghỉ).
    expect((await deliveries(ids.HOLIDAY)).map((x) => x.milestone)).toContain(
      'D0',
    );
    await reminders.runOnce(new Date('2027-03-23T01:00:00Z'));
    expect(
      await ctx.prisma.notificationDelivery.count({
        where: { milestone: 'DIGEST', dueKey: d('2027-03-23') },
      }),
    ).toBeGreaterThan(0);
  });
});
