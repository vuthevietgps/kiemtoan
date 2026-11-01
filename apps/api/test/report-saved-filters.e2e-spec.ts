import JSZip from 'jszip';
import { AddressInfo, createServer, Server } from 'node:net';
import { NotificationMailer } from '../src/modules/notifications/notification-mailer';
import { ReminderService } from '../src/modules/notifications/reminder.service';
import { ReportScheduleService } from '../src/modules/reports/report-schedule.service';
import { relogin } from './utils/auth-flow';
import { createTestContext, TestContext } from './utils/test-app';

/**
 * 10-F: bộ lọc đã lưu (M11), hẹn gửi định kỳ (M12). Đồng hồ giả lập: thứ 2, 09/11/2026 08:00 giờ VN.
 * Việc của `staff` và `staff2` có hạn trong tuần trước để file đính kèm có dữ liệu theo phạm vi.
 */
interface Filter {
  id: string;
  report: string;
  name: string;
  params: Record<string, string>;
  schedule: {
    frequency: string;
    enabled: boolean;
    lastSentAt: string | null;
    lastResult: string | null;
    stoppedReason: string | null;
  } | null;
}
type UserKey = keyof TestContext['users'];

const MONDAY = new Date('2026-11-09T01:00:00Z');
const NEXT_MONDAY = new Date('2026-11-16T01:00:00Z');
const BEFORE_SEND_TIME = new Date('2026-11-09T00:29:00Z');
const LAST_WEEK = { from: '2026-11-02', to: '2026-11-08' };

/** Hộp thư SMTP giả tối thiểu: chỉ nhận thư, giữ lại toàn văn để kiểm tra file đính kèm. */
function fakeSmtp(received: string[]): Server {
  return createServer((socket) => {
    let inData = false;
    let body = '';
    socket.write('220 fake ESMTP\r\n');
    socket.on('data', (chunk) => {
      const text = chunk.toString();
      if (inData) {
        body += text;
        if (!body.endsWith('\r\n.\r\n')) return;
        received.push(body);
        inData = false;
        body = '';
        socket.write('250 OK\r\n');
      } else if (/^DATA/i.test(text)) {
        inData = true;
        socket.write('354 go\r\n');
      } else if (/^QUIT/i.test(text)) {
        socket.end('221 bye\r\n');
      } else socket.write('250 OK\r\n');
    });
  });
}

async function sheetText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const sheet = Object.keys(zip.files).find((f) =>
    f.startsWith('xl/worksheets/'),
  )!;
  return zip.file(sheet)!.async('string');
}

describe('Report saved filters & schedules (e2e)', () => {
  let ctx: TestContext;
  let schedules: ReportScheduleService;
  let mailer: NotificationMailer;

  const as = (key: UserKey) => ctx.api(ctx.users[key]);
  const create = async (key: UserKey, body: object) =>
    (await as(key).post('/reports/saved-filters').send(body).expect(201))
      .body as Filter;
  /** Bật lịch rồi đặt lúc bật về trước đồng hồ giả lập. */
  const schedule = async (key: UserKey, id: string, frequency = 'WEEKLY') => {
    await as(key)
      .put(`/reports/saved-filters/${id}/schedule`)
      .send({ frequency, enabled: true })
      .expect(200);
    await ctx.prisma.reportSchedule.update({
      where: { savedFilterId: id },
      data: { activeFrom: new Date('2026-11-01T00:00:00Z') },
    });
  };
  const deliveries = () =>
    ctx.prisma.notificationDelivery.findMany({
      where: { subjectType: 'REPORT' },
      orderBy: { createdAt: 'asc' },
    });

  beforeAll(async () => {
    ctx = await createTestContext();
    schedules = ctx.app.get(ReportScheduleService);
    mailer = ctx.app.get(NotificationMailer);
    const { users, prisma } = ctx;
    const customer = await prisma.customer.create({
      data: { name: 'KH lịch', taxCode: 'SCH-1', ownerId: users.staff.id },
    });
    for (const assigneeId of [users.staff.id, users.staff2.id])
      await prisma.task.create({
        data: {
          customerId: customer.id,
          assigneeId,
          title: 'Việc tuần trước',
          dueDate: new Date('2026-11-04T00:00:00Z'),
          originalDueDate: new Date('2026-11-04T00:00:00Z'),
          status: 'COMPLETED',
          completedAt: new Date('2026-11-03T03:00:00Z'),
        },
      });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await ctx.prisma.notificationDelivery.deleteMany({
      where: { subjectType: 'REPORT' },
    });
    await ctx.prisma.reportSavedFilter.deleteMany();
    await ctx.prisma.notification.deleteMany({
      where: { subjectType: 'REPORT' },
    });
  });

  describe('Bộ lọc đã lưu (M11)', () => {
    const body = {
      report: 'capability',
      name: 'Trưởng nhóm kế toán',
      params: {
        from: '2026-01-01',
        to: '2026-06-30',
        role: 'LEAD',
        domain: 'ACCOUNTING',
      },
    };

    it('lưu, mở lại đúng tham số, cập nhật, xoá; trùng tên bị từ chối', async () => {
      const saved = await create('manager', body);
      const list = await as('manager')
        .get('/reports/saved-filters?report=capability')
        .expect(200);
      expect(list.body).toHaveLength(1);
      const opened = await as('manager')
        .get(`/reports/saved-filters/${saved.id}`)
        .expect(200);
      expect((opened.body as Filter).params).toEqual(body.params);
      await as('manager').post('/reports/saved-filters').send(body).expect(409);
      const updated = await as('manager')
        .patch(`/reports/saved-filters/${saved.id}`)
        .send({ name: 'Đổi tên', params: { role: 'MANAGER' } })
        .expect(200);
      expect(updated.body).toMatchObject({
        name: 'Đổi tên',
        params: { role: 'MANAGER' },
      });
      await as('manager')
        .delete(`/reports/saved-filters/${saved.id}`)
        .expect(200);
      await as('manager').get(`/reports/saved-filters/${saved.id}`).expect(404);
    });

    it('riêng từng người: người khác không thấy, không sửa, không tải được', async () => {
      const saved = await create('manager', body);
      const others = await as('staff')
        .get('/reports/saved-filters')
        .expect(200);
      expect(others.body).toEqual([]);
      const path = `/reports/saved-filters/${saved.id}`;
      await as('staff').get(path).expect(404);
      await as('staff').patch(path).send({ name: 'x' }).expect(404);
      await as('staff').delete(path).expect(404);
      await as('director').get(path).expect(404);
      await as('director').get(`${path}/export`).expect(404);
    });

    it('từ chối tham số lạ (không lưu token) và giá trị sai', async () => {
      const post = (params: object) =>
        as('manager')
          .post('/reports/saved-filters')
          .send({ ...body, params });
      await post({ token: 'abc' }).expect(400);
      await post({ format: 'csv' }).expect(400);
      await post({ groupBy: 'customer' }).expect(400);
      await post({ role: 'CEO' }).expect(400);
      await post({ from: 'hôm qua' }).expect(400);
      await as('manager')
        .post('/reports/saved-filters')
        .send({ ...body, report: 'audit-log' })
        .expect(400);
    });

    it('theo quyền báo cáo: nhân viên không lưu Doanh thu, thu tiền không lưu báo cáo vận hành', async () => {
      const revenue = { report: 'revenue', name: 'DT', params: {} };
      await as('staff')
        .post('/reports/saved-filters')
        .send(revenue)
        .expect(403);
      await create('cashier', revenue);
      await as('cashier')
        .post('/reports/saved-filters')
        .send({ ...body, name: 'NL' })
        .expect(403);
      await create('staff', { ...body, name: 'Của tôi' });
      await as('admin').get('/reports/saved-filters').expect(403);
    });

    it('mất quyền tài chính: bộ lọc Doanh thu bị ẩn và không mở / tải được', async () => {
      const saved = await create('manager', {
        report: 'revenue',
        name: 'DT',
        params: { groupBy: 'customer' },
      });
      await as('director')
        .post(`/users/${ctx.users.manager.id}/access-requests`)
        .send({ role: 'MANAGER', financialAccess: false })
        .expect(201);
      await relogin(ctx, ctx.users.manager);
      const list = await as('manager')
        .get('/reports/saved-filters')
        .expect(200);
      expect(list.body).toEqual([]);
      await as('manager').get(`/reports/saved-filters/${saved.id}`).expect(403);
      await as('manager')
        .get(`/reports/saved-filters/${saved.id}/export`)
        .expect(403);
      await as('director')
        .post(`/users/${ctx.users.manager.id}/access-requests`)
        .send({ role: 'MANAGER', financialAccess: null })
        .expect(201);
      await relogin(ctx, ctx.users.manager);
    });

    it('tải Excel theo bộ lọc: cần quyền xuất, ghi nhật ký EXPORT', async () => {
      const mine = await create('staff', { ...body, name: 'NV' });
      await as('staff')
        .get(`/reports/saved-filters/${mine.id}/export`)
        .expect(403);
      const saved = await create('manager', body);
      await as('manager')
        .get(
          `/reports/saved-filters/${saved.id}/export?from=2026-11-02&to=2026-11-08`,
        )
        .expect(200)
        .expect('Content-Type', /spreadsheetml/);
      const logged = () =>
        ctx.prisma.auditLog.count({
          where: { action: 'EXPORT', entity: 'reports', entityId: saved.id },
        });
      for (let i = 0; i < 20 && !(await logged()); i++)
        await new Promise((resolve) => setTimeout(resolve, 100));
      expect(await logged()).toBeGreaterThan(0);
    });
  });

  describe('Hẹn gửi định kỳ (M12)', () => {
    const capability = {
      report: 'capability',
      name: 'Năng lực trợ lý',
      params: { from: '2020-01-01', to: '2020-12-31', role: 'ASSISTANT' },
    };

    it('cần quyền xuất; chỉ đặt lịch cho bộ lọc của mình', async () => {
      const mine = await create('staff', capability);
      const path = `/reports/saved-filters/${mine.id}/schedule`;
      const payload = { frequency: 'WEEKLY', enabled: true };
      await as('staff').put(path).send(payload).expect(403);
      const saved = await create('manager', capability);
      await as('director')
        .put(`/reports/saved-filters/${saved.id}/schedule`)
        .send(payload)
        .expect(404);
      await as('manager')
        .put(`/reports/saved-filters/${saved.id}/schedule`)
        .send({ frequency: 'DAILY', enabled: true })
        .expect(400);
    });

    it('đúng giờ, đính kèm Excel theo phạm vi tại lúc gửi và kỳ tuần trước; chạy lại không gửi trùng', async () => {
      const saved = await create('manager', capability);
      await schedule('manager', saved.id);
      jest.spyOn(mailer, 'isConfigured').mockReturnValue(true);
      const send = jest.spyOn(mailer, 'send').mockResolvedValue();

      expect(await schedules.runOnce(BEFORE_SEND_TIME)).toMatchObject({
        sent: 0,
      });
      expect(send).not.toHaveBeenCalled();

      expect(await schedules.runOnce(MONDAY)).toMatchObject({ sent: 1 });
      expect(send).toHaveBeenCalledTimes(1);
      const [to, subject, text, files] = send.mock.calls[0];
      expect(to).toBe(ctx.users.manager.email);
      expect(subject).toContain('02/11/2026 – 08/11/2026');
      expect(text).toContain(
        `/reports?savedFilter=${saved.id}&from=${LAST_WEEK.from}&to=${LAST_WEEK.to}`,
      );
      expect(files![0].filename).toBe('danh-gia-nang-luc.xlsx');
      const sheet = await sheetText(files![0].content);
      expect(sheet).toContain('Test staff');
      expect(sheet).not.toContain('Test staff2');

      // Chạy lại, khởi động lại: khoá lượt gửi giữ một dòng.
      expect(await schedules.runOnce(MONDAY)).toMatchObject({ sent: 0 });
      expect(
        await schedules.runOnce(new Date('2026-11-11T02:00:00Z')),
      ).toMatchObject({ sent: 0 });
      expect(send).toHaveBeenCalledTimes(1);
      expect(await deliveries()).toHaveLength(1);
      expect((await deliveries())[0]).toMatchObject({
        status: 'SENT',
        milestone: 'WEEKLY',
      });

      const reopened = await as('manager')
        .get(`/reports/saved-filters/${saved.id}`)
        .expect(200);
      expect((reopened.body as Filter).schedule).toMatchObject({
        lastResult: 'SENT',
        lastSentAt: MONDAY.toISOString(),
      });
      expect(
        await ctx.prisma.auditLog.count({
          where: {
            action: 'EXPORT',
            entity: 'reports',
            entityId: saved.id,
            userId: ctx.users.manager.id,
          },
        }),
      ).toBe(1);

      expect(await schedules.runOnce(NEXT_MONDAY)).toMatchObject({ sent: 1 });
      expect(send).toHaveBeenCalledTimes(2);
    });

    it('hằng tháng: ngày 1, số liệu tháng trước; thứ 2 không gửi', async () => {
      const saved = await create('manager', capability);
      await schedule('manager', saved.id, 'MONTHLY');
      await ctx.prisma.reportSchedule.update({
        where: { savedFilterId: saved.id },
        data: { activeFrom: new Date('2026-11-05T00:00:00Z') },
      });
      jest.spyOn(mailer, 'isConfigured').mockReturnValue(true);
      const send = jest.spyOn(mailer, 'send').mockResolvedValue();
      expect(await schedules.runOnce(MONDAY)).toMatchObject({ sent: 0 });
      expect(
        await schedules.runOnce(new Date('2026-12-01T00:30:00Z')),
      ).toMatchObject({ sent: 1 });
      expect(send.mock.calls[0][1]).toContain('01/11/2026 – 30/11/2026');
    });

    it('bật lịch sau mốc gửi thì không gửi bù; tắt lịch thì không gửi', async () => {
      const saved = await create('manager', capability);
      await schedule('manager', saved.id);
      await ctx.prisma.reportSchedule.update({
        where: { savedFilterId: saved.id },
        data: { activeFrom: new Date('2026-11-10T00:00:00Z') },
      });
      jest.spyOn(mailer, 'isConfigured').mockReturnValue(true);
      const send = jest.spyOn(mailer, 'send').mockResolvedValue();
      await schedules.runOnce(new Date('2026-11-12T01:00:00Z'));
      expect(send).not.toHaveBeenCalled();
      await as('manager')
        .put(`/reports/saved-filters/${saved.id}/schedule`)
        .send({ frequency: 'WEEKLY', enabled: false })
        .expect(200);
      await schedules.runOnce(NEXT_MONDAY);
      expect(send).not.toHaveBeenCalled();
    });

    it('chưa có SMTP: thông báo trong ứng dụng kèm link, ghi rõ chưa gửi email, không trùng', async () => {
      const saved = await create('manager', capability);
      await schedule('manager', saved.id);
      jest.spyOn(mailer, 'isConfigured').mockReturnValue(false);
      const send = jest.spyOn(mailer, 'send').mockResolvedValue();
      expect(await schedules.runOnce(MONDAY)).toMatchObject({ notEmailed: 1 });
      expect(await schedules.runOnce(MONDAY)).toMatchObject({ notEmailed: 0 });
      expect(send).not.toHaveBeenCalled();
      const notes = await ctx.prisma.notification.findMany({
        where: { subjectType: 'REPORT', userId: ctx.users.manager.id },
      });
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toContain('chưa gửi email');
      expect(notes[0].link).toBe(
        `/reports?savedFilter=${saved.id}&from=${LAST_WEEK.from}&to=${LAST_WEEK.to}`,
      );
      expect((await deliveries())[0]).toMatchObject({
        status: 'SKIPPED',
        lastError: 'Không gửi — chưa cấu hình SMTP',
      });
    });

    it('lỗi SMTP: thử lại theo lịch, hết lượt thì báo trong ứng dụng; nhắc việc 06 không gửi hộ', async () => {
      const saved = await create('manager', capability);
      await schedule('manager', saved.id);
      jest.spyOn(mailer, 'isConfigured').mockReturnValue(true);
      const send = jest
        .spyOn(mailer, 'send')
        .mockRejectedValue(new Error('SMTP down'));
      expect(await schedules.runOnce(MONDAY)).toMatchObject({ retry: 1 });
      expect((await deliveries())[0].status).toBe('PENDING');

      // Bộ gửi email của nhắc việc bỏ qua dòng báo cáo (không có file đính kèm).
      const reminderStats = await ctx.app
        .get(ReminderService)
        .sendEmails(new Date('2026-11-09T02:00:00Z'));
      expect(reminderStats.retry).toBe(0);
      expect(send).toHaveBeenCalledTimes(1);

      let at = MONDAY.getTime();
      for (let i = 0; i < 4; i++) {
        at += 5 * 3_600_000;
        await schedules.runOnce(new Date(at));
      }
      expect(send).toHaveBeenCalledTimes(5);
      expect((await deliveries())[0]).toMatchObject({
        status: 'FAILED',
        lastError: 'SMTP down',
      });
      const notes = await ctx.prisma.notification.findMany({
        where: { subjectType: 'REPORT', userId: ctx.users.manager.id },
      });
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toContain('gửi email thất bại');
    });

    it('mất quyền tại lúc gửi: dừng lịch, không tạo file, báo chủ lịch; lần sau không xử lý nữa', async () => {
      const saved = await create('manager', {
        report: 'revenue',
        name: 'Doanh thu tuần',
        params: { groupBy: 'customer' },
      });
      await schedule('manager', saved.id);
      jest.spyOn(mailer, 'isConfigured').mockReturnValue(true);
      const send = jest.spyOn(mailer, 'send').mockResolvedValue();
      await as('director')
        .post(`/users/${ctx.users.manager.id}/access-requests`)
        .send({ role: 'MANAGER', financialAccess: false })
        .expect(201);

      expect(await schedules.runOnce(MONDAY)).toMatchObject({
        stopped: 1,
        sent: 0,
      });
      expect(send).not.toHaveBeenCalled();
      const row = await ctx.prisma.reportSchedule.findUniqueOrThrow({
        where: { savedFilterId: saved.id },
      });
      expect(row).toMatchObject({
        enabled: false,
        lastResult: 'STOPPED',
        stoppedReason: 'Bạn không còn quyền xuất báo cáo này',
      });
      expect((await deliveries())[0].status).toBe('CANCELLED');
      expect(
        await ctx.prisma.notification.count({
          where: { subjectType: 'REPORT', userId: ctx.users.manager.id },
        }),
      ).toBe(1);
      expect(await schedules.runOnce(NEXT_MONDAY)).toMatchObject({
        stopped: 0,
      });

      await as('director')
        .post(`/users/${ctx.users.manager.id}/access-requests`)
        .send({ role: 'MANAGER', financialAccess: null })
        .expect(201);
      await relogin(ctx, ctx.users.manager);
    });

    it('tài khoản ngừng hoạt động: dừng lịch, không gửi', async () => {
      const saved = await create('manager', capability);
      await schedule('manager', saved.id);
      jest.spyOn(mailer, 'isConfigured').mockReturnValue(true);
      const send = jest.spyOn(mailer, 'send').mockResolvedValue();
      await ctx.prisma.user.update({
        where: { id: ctx.users.manager.id },
        data: { isActive: false },
      });
      expect(await schedules.runOnce(MONDAY)).toMatchObject({ stopped: 1 });
      expect(send).not.toHaveBeenCalled();
      await ctx.prisma.user.update({
        where: { id: ctx.users.manager.id },
        data: { isActive: true },
      });
    });

    it('xoá bộ lọc xoá lịch; xoá lịch vẫn giữ bộ lọc', async () => {
      const saved = await create('manager', capability);
      await schedule('manager', saved.id);
      const removed = await as('manager')
        .delete(`/reports/saved-filters/${saved.id}/schedule`)
        .expect(200);
      expect((removed.body as Filter).schedule).toBeNull();
      await schedule('manager', saved.id);
      await as('manager')
        .delete(`/reports/saved-filters/${saved.id}`)
        .expect(200);
      expect(await ctx.prisma.reportSchedule.count()).toBe(0);
    });

    it('gửi thật qua SMTP: thư tới đúng người, có file Excel đính kèm', async () => {
      const received: string[] = [];
      const server = fakeSmtp(received);
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      const env = {
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String((server.address() as AddressInfo).port),
        SMTP_FROM: 'bao-cao@test.vn',
      };
      Object.assign(process.env, env);
      try {
        const saved = await create('manager', capability);
        await schedule('manager', saved.id);
        expect(await schedules.runOnce(MONDAY)).toMatchObject({ sent: 1 });
        expect(received).toHaveLength(1);
        expect(received[0]).toContain(`To: ${ctx.users.manager.email}`);
        expect(received[0]).toContain('danh-gia-nang-luc.xlsx');
        expect(received[0]).toContain('spreadsheetml');
      } finally {
        for (const key of Object.keys(env)) delete process.env[key];
        server.close();
      }
    });

    it('hai tiến trình cùng lúc: chỉ một lượt gửi', async () => {
      const saved = await create('manager', capability);
      await schedule('manager', saved.id);
      jest.spyOn(mailer, 'isConfigured').mockReturnValue(true);
      const send = jest.spyOn(mailer, 'send').mockResolvedValue();
      await Promise.all([schedules.runOnce(MONDAY), schedules.runOnce(MONDAY)]);
      expect(send).toHaveBeenCalledTimes(1);
    });
  });
});
