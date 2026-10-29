import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

/**
 * Gửi email nhắc việc qua SMTP (đặc tả 06, I10; M365 khi IT cấp — QD09). Cùng biến môi trường
 * `SMTP_*` với email tài khoản; chưa đặt `SMTP_HOST` thì không gửi (ghi "Không gửi — chưa cấu hình").
 * Lỗi gửi ném ra để ReminderService thử lại theo I12.
 */
@Injectable()
export class NotificationMailer {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('SMTP_HOST');
  }

  /** Địa chỉ giao diện để ghép liên kết trong email. */
  appOrigin(): string {
    return this.config
      .get<string>(
        'APP_PUBLIC_URL',
        this.config.get<string>('CORS_ORIGIN', 'http://localhost:4200'),
      )
      .split(',')[0]
      .replace(/\/$/, '');
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    const user = this.config.get<string>('SMTP_USER');
    const transport = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.config.get('SMTP_PORT', 587)),
      secure: this.config.get('SMTP_SECURE', 'false') === 'true',
      ...(user
        ? {
            auth: {
              user,
              pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
            },
          }
        : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    await transport.sendMail({
      from: this.config.getOrThrow<string>('SMTP_FROM'),
      to,
      subject,
      text,
    });
  }
}
