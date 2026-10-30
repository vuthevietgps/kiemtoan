import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SecretVerificationService } from '../../../core/auth/secret-verification.service';
import { ClientCredentialsApi, SecretPurpose } from './client-credentials.api';

/**
 * Lấy mật khẩu / PIN (L6, QD02): máy chủ đòi xác nhận lại mật khẩu sau 5 phút → mở hộp xác nhận rồi thử
 * lại một lần. Huỷ xác nhận → null. Lỗi khác ném ra cho nơi gọi hiện thông báo. Cung cấp ở thành phần
 * dùng nó (cùng `SecretVerificationService`) để hộp xác nhận lấy được `NzModalService` của thành phần.
 */
@Injectable()
export class SecretAccessService {
  private readonly api = inject(ClientCredentialsApi);
  private readonly verification = inject(SecretVerificationService);

  async fetch(id: string, purpose: SecretPurpose): Promise<string | null> {
    try {
      return (await firstValueFrom(this.api.secret(id, purpose))).password;
    } catch (err) {
      if (!(err instanceof HttpErrorResponse) || err.error?.code !== 'SECRET_REAUTH_REQUIRED')
        throw err;
      if (!(await this.verification.verify())) return null;
      return (await firstValueFrom(this.api.secret(id, purpose))).password;
    }
  }
}
