/**
 * Lệnh vận hành khoá kho tài khoản (đặc tả 09, L12; hướng dẫn docs/operations/credential-key.md).
 *   check  — giải mã thử mọi bí mật bằng CREDENTIAL_KEY; exit 1 nếu có bản ghi lỗi.
 *   rotate — mã hoá lại bằng NEW_CREDENTIAL_KEY (khoá cũ: CREDENTIAL_KEY), rồi kiểm tra bằng khoá mới.
 * Khoá chỉ đọc từ biến môi trường (không truyền qua tham số để không lưu trong lịch sử lệnh).
 * Không in bí mật; chỉ in số lượng và id bản ghi lỗi.
 */
import { PrismaClient } from '@prisma/client';
import { credentialKey } from './aes-gcm';
import { checkCredentialKey, rotateCredentialKey } from './credential-key';

async function main(command: string | undefined): Promise<number> {
  const prisma = new PrismaClient();
  try {
    const key = credentialKey(process.env.CREDENTIAL_KEY);
    if (command === 'check') {
      const { total, failedIds } = await checkCredentialKey(prisma, key);
      console.log(`Đã kiểm ${total} bí mật; giải mã lỗi: ${failedIds.length}`);
      for (const id of failedIds) console.log(`  lỗi: ${id}`);
      return failedIds.length ? 1 : 0;
    }
    if (command === 'rotate') {
      const next = credentialKey(process.env.NEW_CREDENTIAL_KEY);
      const { rotated } = await rotateCredentialKey(prisma, key, next);
      const { failedIds } = await checkCredentialKey(prisma, next);
      console.log(
        `Đã mã hoá lại ${rotated} bí mật bằng khoá mới; kiểm tra lại lỗi: ${failedIds.length}`,
      );
      console.log('Cập nhật CREDENTIAL_KEY = khoá mới rồi khởi động lại API.');
      return failedIds.length ? 1 : 0;
    }
    console.error('Dùng: credential-key check | rotate');
    return 2;
  } finally {
    await prisma.$disconnect();
  }
}

main(process.argv[2]).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
