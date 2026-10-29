import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class AuthMailer {
  private readonly logger = new Logger(AuthMailer.name);
  constructor(private readonly config: ConfigService) {}

  async send(email: string, link: string, purpose: string): Promise<boolean> {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return false;
    try {
      const user = this.config.get<string>('SMTP_USER');
      const transport = nodemailer.createTransport({
        host,
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
        to: email,
        subject:
          purpose === 'INVITE' ? 'Kích hoạt tài khoản' : 'Đặt lại mật khẩu',
        text: `Mở liên kết sau để ${purpose === 'INVITE' ? 'kích hoạt tài khoản' : 'đặt lại mật khẩu'}: ${link}\nLiên kết chỉ dùng một lần. Nếu không yêu cầu, hãy bỏ qua email này.`,
      });
      return true;
    } catch {
      this.logger.warn(
        'Không gửi được email tài khoản; kiểm tra cấu hình SMTP.',
      );
      return false;
    }
  }
}
