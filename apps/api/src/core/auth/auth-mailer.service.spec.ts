import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { AuthMailer } from './auth-mailer.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));
const createTransport = jest.mocked(nodemailer.createTransport);
describe('Account email delivery', () => {
  beforeEach(() => jest.resetAllMocks());
  it('reports unconfigured delivery without pretending an email was sent', async () => {
    expect(
      await new AuthMailer(new ConfigService({})).send(
        'user@test.vn',
        'https://app/activate#token=secret',
        'INVITE',
      ),
    ).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });
  it.each(['INVITE', 'RESET'])(
    'sends a %s message using the configured transport',
    async (purpose) => {
      const sendMail = jest.fn().mockResolvedValue({ messageId: 'local-test' });
      createTransport.mockReturnValue({ sendMail } as unknown as ReturnType<
        typeof nodemailer.createTransport
      >);
      const config = new ConfigService({
        SMTP_HOST: 'smtp.test.invalid',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'smtp-user',
        SMTP_PASSWORD: 'smtp-password',
        SMTP_FROM: 'support@test.vn',
      });
      const link = 'https://app/activate#token=one-time-token';
      expect(
        await new AuthMailer(config).send('user@test.vn', link, purpose),
      ).toBe(true);
      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.test.invalid',
          port: 465,
          secure: true,
          auth: { user: 'smtp-user', pass: 'smtp-password' },
        }),
      );
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.vn',
          from: 'support@test.vn',
          text: expect.stringContaining(link) as unknown,
        }),
      );
    },
  );
  it('returns a delivery failure and logs no credentials or action token', async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValue(new Error('sensitive smtp details'));
    createTransport.mockReturnValue({ sendMail } as unknown as ReturnType<
      typeof nodemailer.createTransport
    >);
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      expect(
        await new AuthMailer(
          new ConfigService({
            SMTP_HOST: 'smtp.test.invalid',
            SMTP_FROM: 'support@test.vn',
          }),
        ).send('user@test.vn', 'https://app/#token=secret-token', 'RESET'),
      ).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(
        /secret-token|sensitive smtp details|user@test.vn/,
      );
    } finally {
      warn.mockRestore();
    }
  });
});
