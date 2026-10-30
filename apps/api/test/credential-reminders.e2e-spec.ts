import { Prisma } from '@prisma/client';
import { NotificationMailer } from '../src/modules/notifications/notification-mailer';
import { ReminderService } from '../src/modules/notifications/reminder.service';
import { createTestContext, TestContext } from './utils/test-app';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
// Thứ 4 10/03/2027, 08:00 giờ VN (năm 2027 chưa xác nhận lịch → thứ 2–6 là ngày làm việc).
const NOW = new Date('2027-03-10T01:00:00Z');
const minutes = (base: Date, m: number) =>
  new Date(base.getTime() + m * 60_000);

/**
 * 09-C (L9): nhắc hạn token / tài khoản ở mốc 30, 7, 1 ngày trước và đúng ngày (người phụ trách KH +
 * người đang mượn); token đến hạn trả (người mượn) và quá 1 ngày làm việc (thêm người phụ trách KH);
 * chạy lại không trùng; trả token / gia hạn thì huỷ email chờ; không có bí mật trong nhắc.
 */
describe('09-C nhắc hạn kho tài khoản (e2e)', () => {
  let ctx: TestContext;
  let reminders: ReminderService;
  let mailer: NotificationMailer;
  let customerId: string;
  const ids: Record<string, string> = {};

  const credential = async (
    key: string,
    data: Partial<Prisma.ClientCredentialUncheckedCreateInput>,
  ) => {
    const token = !data.type || data.type === 'DIGITAL_SIGNATURE';
    ids[key] = (
      await ctx.prisma.clientCredential.create({
        data: {
          customerId,
          type: 'DIGITAL_SIGNATURE',
          ...(token && {
            provider: 'VNPT_CA',
            serialNumber: `SN-${key}`,
            custody: 'OFFICE',
          }),
          passwordEnc: 'khong-phai-ban-ro',
          ...data,
        },
      })
    ).id;
  };
  const loan = (holderId: string, due: string) => ({
    custody: 'LOANED' as const,
    holderId,
    loanedAt: d('2027-03-01'),
    loanDueAt: d(due),
  });
  const deliveries = (key: string) =>
    ctx.prisma.notificationDelivery.findMany({
      where: { subjectType: 'CREDENTIAL', subjectId: ids[key] },
      orderBy: [{ channel: 'asc' }, { userId: 'asc' }],
    });
  const summary = async (key: string) =>
    (await deliveries(key))
      .map((x) => `${x.milestone}|${x.channel}|${x.userId}`)
      .sort();

  beforeAll(async () => {
    ctx = await createTestContext();
    reminders = ctx.app.get(ReminderService);
    mailer = ctx.app.get(NotificationMailer);
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Token Nhắc',
          taxCode: '0100009103',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    await credential('D30', { expiresAt: d('2027-04-09') });
    await credential('D1', {
      expiresAt: d('2027-03-11'),
      ...loan(ctx.users.manager.id, '2027-03-12'),
    });
    await credential('D0', { expiresAt: d('2027-03-10') });
    await credential('PAST', { expiresAt: d('2027-03-09') });
    await credential('ACC', {
      type: 'TAX_PORTAL',
      label: 'Thuế điện tử',
      username: '0100009103',
      expiresAt: d('2027-03-17'),
    });
    await credential('GONE', {
      expiresAt: d('2027-03-10'),
      deletedAt: new Date(),
    });
    await credential('LOAN0', {
      expiresAt: d('2028-01-01'),
      ...loan(ctx.users.staff2.id, '2027-03-10'),
    });
    await credential('LOANESC', {
      expiresAt: d('2028-01-01'),
      ...loan(ctx.users.staff2.id, '2027-03-09'),
    });
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await ctx.app.close();
  });

  it('mốc hạn đúng người, đúng kênh; mượn đến hạn / quá hạn; chạy lại không trùng', async () => {
    await reminders.runOnce(NOW);
    const { staff, staff2, manager } = ctx.users;
    expect(await summary('D30')).toEqual([`EXP:D-30|IN_APP|${staff.id}`]);
    expect(await summary('D1')).toEqual(
      [
        `EXP:D-1|EMAIL|${staff.id}`,
        `EXP:D-1|EMAIL|${manager.id}`,
        `EXP:D-1|IN_APP|${staff.id}`,
        `EXP:D-1|IN_APP|${manager.id}`,
      ].sort(),
    );
    expect(await summary('D0')).toEqual(
      [`EXP:D0|EMAIL|${staff.id}`, `EXP:D0|IN_APP|${staff.id}`].sort(),
    );
    expect(await summary('ACC')).toEqual([`EXP:D-7|IN_APP|${staff.id}`]);
    expect(await summary('PAST')).toEqual([]);
    expect(await summary('GONE')).toEqual([]);
    expect(await summary('LOAN0')).toEqual(
      [`LOAN:D0|EMAIL|${staff2.id}`, `LOAN:D0|IN_APP|${staff2.id}`].sort(),
    );
    expect(await summary('LOANESC')).toEqual(
      [
        `LOAN:ESC|EMAIL|${staff.id}`,
        `LOAN:ESC|EMAIL|${staff2.id}`,
        `LOAN:ESC|IN_APP|${staff.id}`,
        `LOAN:ESC|IN_APP|${staff2.id}`,
      ].sort(),
    );
    const titles = (await deliveries('D0'))
      .concat(await deliveries('LOANESC'))
      .map((x) => x.title);
    expect(titles).toContain(
      'Hết hạn hôm nay: Chữ ký số VNPT-CA SN-D0 — Công ty Token Nhắc, hạn 10/03/2027',
    );
    expect(titles).toContain(
      'Mượn token quá hạn trả: Chữ ký số VNPT-CA SN-LOANESC — Công ty Token Nhắc, hạn trả 09/03/2027',
    );
    const notification = await ctx.prisma.notification.findFirstOrThrow({
      where: { subjectId: ids.D30 },
    });
    expect(notification).toMatchObject({
      userId: staff.id,
      link: `/client-credentials?id=${ids.D30}`,
      title:
        'Sắp đến hạn (còn 30 ngày): Chữ ký số VNPT-CA SN-D30 — Công ty Token Nhắc, hạn 09/04/2027',
    });
    const before = await ctx.prisma.notificationDelivery.count();
    await reminders.runOnce(minutes(NOW, 15));
    expect(await ctx.prisma.notificationDelivery.count()).toBe(before);
    const dump = JSON.stringify(await ctx.prisma.notification.findMany());
    expect(dump).not.toContain('khong-phai-ban-ro');
  });

  it('trả token / gia hạn chứng thư → email chờ gửi bị huỷ, không nhắc mốc cũ nữa', async () => {
    jest.spyOn(mailer, 'isConfigured').mockReturnValue(true);
    jest.spyOn(mailer, 'send').mockRejectedValue(new Error('SMTP down'));
    // Hôm sau (thứ 5 11/03): token D1 đến mốc D0, token mượn LOAN0 sang mốc báo người phụ trách.
    const next = new Date('2027-03-11T01:00:00Z');
    await reminders.runOnce(next);
    const pending = (key: string, milestone: string) =>
      ctx.prisma.notificationDelivery.findMany({
        where: {
          subjectId: ids[key],
          milestone,
          channel: 'EMAIL',
        },
      });
    expect((await pending('LOAN0', 'LOAN:ESC')).map((x) => x.status)).toEqual([
      'PENDING',
      'PENDING',
    ]);
    expect((await pending('D1', 'EXP:D0')).map((x) => x.status)).toEqual([
      'PENDING',
      'PENDING',
    ]);
    await ctx.prisma.clientCredential.update({
      where: { id: ids.LOAN0 },
      data: {
        custody: 'OFFICE',
        holderId: null,
        loanedAt: null,
        loanDueAt: null,
      },
    });
    await ctx.prisma.clientCredential.update({
      where: { id: ids.D1 },
      data: { expiresAt: d('2029-03-11') },
    });
    await reminders.runOnce(minutes(next, 30));
    for (const row of [
      ...(await pending('LOAN0', 'LOAN:ESC')),
      ...(await pending('D1', 'EXP:D0')),
    ])
      expect(row.status).toBe('CANCELLED');
    await reminders.runOnce(new Date('2027-03-12T01:00:00Z'));
    expect(
      await ctx.prisma.notificationDelivery.count({
        where: {
          subjectId: { in: [ids.LOAN0, ids.D1] },
          createdAt: { gt: minutes(next, 31) },
        },
      }),
    ).toBe(0);
  });
});
