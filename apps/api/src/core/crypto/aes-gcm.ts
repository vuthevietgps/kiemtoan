import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM cho bí mật tài khoản khách hàng: base64(iv 12 byte | tag 16 byte | dữ liệu). Dùng chung
 * cho `CryptoService` và script kiểm tra / xoay khoá (đặc tả 09, L12).
 */

/** Khoá `CREDENTIAL_KEY`: chuỗi đúng 32 byte UTF-8. */
export function credentialKey(raw: string | undefined): Buffer {
  const key = Buffer.from(raw ?? '', 'utf8');
  if (key.length !== 32)
    throw new Error('CREDENTIAL_KEY phải dài đúng 32 byte');
  return key;
}

export function encryptWith(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

/** Khoá sai hoặc dữ liệu hỏng → lỗi (GCM kiểm tra tag). */
export function decryptWith(key: Buffer, encoded: string): string {
  const raw = Buffer.from(encoded, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([
    decipher.update(raw.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
}
