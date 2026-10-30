/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- res.body của supertest có kiểu any */
import { encryptWith, credentialKey } from '../src/core/crypto/aes-gcm';
import { ReminderService } from '../src/modules/notifications/reminder.service';
import {
  createTestContext,
  TestContext,
  TEST_PASSWORD,
} from './utils/test-app';

const SECRET = 'Rat-Bi-Mat#0917';
const NEW_SECRET = 'Moi-Hon-Nua#2028';
const PIN = 'Pin-0099-8877';
const SECRETS = [SECRET, NEW_SECRET, PIN];
const day = (offset: number) =>
  new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * 09-E (tiêu chí 2): đi hết vòng đời tài khoản / token — tạo, đổi mật khẩu, xem, sao chép, báo lỗi,
 * mượn / trả, nhắc hạn, xoá, lỗi kiểm tra dữ liệu, nhật ký chung — rồi quét mọi phản hồi API, log máy
 * chủ và các bảng có thể chứa văn bản: bí mật chỉ xuất hiện trong phản hồi của lệnh xem / sao chép.
 * Khoá sai (khôi phục DB với khoá khác — L12): 500 báo rõ, không ghi đã xem.
 */
describe('09-E không lộ bí mật (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  const responses: unknown[] = [];
  const serverOutput: string[] = [];
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const keep = <T extends { body: unknown }>(res: T) => {
    responses.push(res.body);
    return res;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    for (const stream of [process.stdout, process.stderr]) {
      const original = stream.write.bind(stream);
      jest.spyOn(stream, 'write').mockImplementation(((
        chunk: unknown,
        ...rest: never[]
      ) => {
        serverOutput.push(String(chunk));
        return original(chunk as string, ...rest);
      }) as typeof stream.write);
    }
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Bảo Mật',
          taxCode: '0100009104',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    await as('manager')
      .post('/auth/verify-password')
      .send({ password: TEST_PASSWORD })
      .expect(201);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await ctx.app.close();
  });

  it('vòng đời đầy đủ: bí mật chỉ có trong phản hồi xem / sao chép', async () => {
    // Lỗi kiểm tra dữ liệu không được nhắc lại mật khẩu đã gửi.
    keep(
      await as('manager')
        .post('/client-credentials')
        .send({ customerId, type: 'OTHER', username: 'u', password: SECRET })
        .expect(400),
    );
    keep(
      await as('manager')
        .post('/client-credentials')
        .send({ customerId, type: 'KHONG_CO', username: 'u', password: SECRET })
        .expect(400),
    );
    const account = keep(
      await as('manager')
        .post('/client-credentials')
        .send({
          customerId,
          type: 'TAX_PORTAL',
          username: '0100009104',
          password: SECRET,
          expiresAt: day(1),
        })
        .expect(201),
    ).body;
    const token = keep(
      await as('manager')
        .post('/client-credentials')
        .send({
          customerId,
          type: 'DIGITAL_SIGNATURE',
          provider: 'BKAV_CA',
          serialNumber: 'BK-09E',
          expiresAt: day(7),
          password: PIN,
        })
        .expect(201),
    ).body;
    const changed = keep(
      await as('manager')
        .patch(`/client-credentials/${account.id}`)
        .send({ revision: account.revision, password: NEW_SECRET })
        .expect(200),
    ).body;
    // Bản cũ → 409, có gửi mật khẩu: phản hồi lỗi không chứa mật khẩu.
    keep(
      await as('manager')
        .patch(`/client-credentials/${account.id}`)
        .send({ revision: account.revision, password: SECRET })
        .expect(409),
    );
    const view = await as('manager')
      .post(`/client-credentials/${account.id}/secret`)
      .send({ purpose: 'VIEW' })
      .expect(200);
    expect(view.body).toEqual({ password: NEW_SECRET });
    const copy = await as('manager')
      .post(`/client-credentials/${token.id}/secret`)
      .send({ purpose: 'COPY' })
      .expect(200);
    expect(copy.body).toEqual({ password: PIN });
    const reported = keep(
      await as('staff')
        .post(`/client-credentials/${account.id}/report-issue`)
        .send({ revision: changed.revision, status: 'ERROR', note: 'Sai' })
        .expect(200),
    ).body;
    const borrowed = keep(
      await as('staff')
        .post(`/client-credentials/${token.id}/borrow`)
        .send({ revision: token.revision, dueDate: day(0) })
        .expect(200),
    ).body;
    keep(
      await as('staff')
        .post(`/client-credentials/${token.id}/return`)
        .send({ revision: borrowed.revision })
        .expect(200),
    );
    await ctx.app
      .get(ReminderService)
      .runOnce(new Date(`${day(0)}T03:00:00.000Z`));
    for (const path of [
      '/client-credentials',
      '/client-credentials?kind=TOKEN',
      `/client-credentials/${account.id}`,
      `/client-credentials/${token.id}`,
      `/client-credentials/${account.id}/access-log`,
      `/client-credentials/${token.id}/access-log`,
    ])
      keep(await as('manager').get(path).expect(200));
    keep(await as('staff').get('/notifications').expect(200));
    keep(
      await as('director')
        .get('/audit-logs?entity=client-credentials')
        .expect(200),
    );
    keep(
      await as('manager')
        .delete(`/client-credentials/${account.id}`)
        .send({ revision: reported.revision, reason: 'Thôi dịch vụ' })
        .expect(200),
    );

    const tables = JSON.stringify([
      await ctx.prisma.credentialEvent.findMany(),
      await ctx.prisma.auditLog.findMany(),
      await ctx.prisma.notification.findMany(),
      await ctx.prisma.notificationDelivery.findMany(),
      await ctx.prisma.clientCredential.findMany(),
    ]);
    expect(await ctx.prisma.notification.count()).toBeGreaterThan(0);
    const haystacks = {
      responses: JSON.stringify(responses),
      tables,
      serverOutput: serverOutput.join(''),
    };
    for (const [where, text] of Object.entries(haystacks))
      for (const secret of SECRETS)
        expect({ where, leaked: text.includes(secret) }).toEqual({
          where,
          leaked: false,
        });
  });

  it('khoá sai (L12): 500 báo rõ khoá không khớp, không ghi đã xem', async () => {
    const wrongKey = credentialKey('ffffffffffffffffffffffffffffffff');
    const id = (
      await ctx.prisma.clientCredential.create({
        data: {
          customerId,
          type: 'EMAIL',
          username: 'kt@kh.vn',
          passwordEnc: encryptWith(wrongKey, SECRET),
        },
      })
    ).id;
    const res = await as('manager')
      .post(`/client-credentials/${id}/secret`)
      .send({ purpose: 'VIEW' })
      .expect(500);
    expect(res.body.message).toMatch(/khoá mã hoá/);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(
      await ctx.prisma.credentialEvent.count({ where: { credentialId: id } }),
    ).toBe(0);
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: id, action: 'VIEW_SECRET' },
      }),
    ).toBe(0);
  });
});
