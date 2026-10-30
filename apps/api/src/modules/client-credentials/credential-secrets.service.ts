import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CredentialEventType } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CryptoService } from '../../core/crypto/crypto.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CredentialStore } from './credential-store';
import { isToken } from './credential.rules';
import type { SecretPurpose } from './dto/client-credential.dto';

const ACCESS = {
  VIEW: { event: CredentialEventType.SECRET_VIEWED, audit: 'VIEW_SECRET' },
  COPY: { event: CredentialEventType.SECRET_COPIED, audit: 'COPY_SECRET' },
} as const;

/**
 * Lấy mật khẩu / PIN (L6, QD02): quyền `view_secret` + xác nhận mật khẩu 5 phút do guard kiểm. Chỉ ghi
 * nhật ký khi giải mã được; nhật ký riêng của tài khoản và nhật ký chung đều không chứa bí mật.
 */
@Injectable()
export class CredentialSecretsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly store: CredentialStore,
  ) {}

  async secret(
    user: AuthUser,
    id: string,
    purpose: SecretPurpose = 'VIEW',
  ): Promise<{ password: string }> {
    const found = await this.store.load(user, id);
    if (!found.passwordEnc)
      throw new BadRequestException(
        isToken(found.type)
          ? 'Token chưa lưu mã PIN'
          : 'Tài khoản chưa lưu mật khẩu',
      );
    const password = this.decrypt(found.passwordEnc);
    const access = ACCESS[purpose];
    await this.store.addEvents(this.prisma, id, user.id, [
      { type: access.event },
    ]);
    await this.audit.log(user.id, access.audit, 'client-credentials', id);
    return { password };
  }

  /** Khoá sai (vd. khôi phục DB với khoá khác — L12) → báo rõ, không ghi nhật ký đã xem. */
  private decrypt(encoded: string): string {
    try {
      return this.crypto.decrypt(encoded);
    } catch {
      throw new InternalServerErrorException(
        'Không giải mã được — khoá mã hoá trên máy chủ không khớp dữ liệu, báo quản trị hệ thống',
      );
    }
  }
}
