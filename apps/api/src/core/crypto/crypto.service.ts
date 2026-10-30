import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { credentialKey, decryptWith, encryptWith } from './aes-gcm';

/** Mã hoá AES-256-GCM cho mật khẩu tài khoản của khách hàng. */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = credentialKey(config.getOrThrow<string>('CREDENTIAL_KEY'));
  }

  encrypt(plain: string): string {
    return encryptWith(this.key, plain);
  }

  decrypt(encoded: string): string {
    return decryptWith(this.key, encoded);
  }
}
