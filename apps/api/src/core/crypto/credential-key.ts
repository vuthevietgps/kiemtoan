import { Prisma, PrismaClient } from '@prisma/client';
import { decryptWith, encryptWith } from './aes-gcm';

/**
 * Kiểm tra và xoay khoá mã hoá kho tài khoản (đặc tả 09, L12). Gồm cả bản ghi đã xoá mềm (vẫn còn bí
 * mật mã hoá). Không bao giờ in hay trả bí mật — chỉ đếm và trả id bản ghi lỗi.
 */

type Db = Pick<Prisma.TransactionClient, 'clientCredential' | '$executeRaw'>;

export interface KeyCheckResult {
  total: number;
  failedIds: string[];
}

async function encrypted(db: Db) {
  return db.clientCredential.findMany({
    where: { passwordEnc: { not: null } },
    select: { id: true, passwordEnc: true },
    orderBy: { id: 'asc' },
  });
}

/** Giải mã thử mọi bí mật bằng `key`; khoá sai / dữ liệu hỏng → có trong `failedIds`. */
export async function checkCredentialKey(
  db: Db,
  key: Buffer,
): Promise<KeyCheckResult> {
  const rows = await encrypted(db);
  const failedIds = rows
    .filter((r) => {
      try {
        decryptWith(key, r.passwordEnc!);
        return false;
      } catch {
        return true;
      }
    })
    .map((r) => r.id);
  return { total: rows.length, failedIds };
}

/**
 * Mã hoá lại toàn bộ bằng khoá mới trong một transaction: chỉ chạy khi mọi bản ghi giải mã được bằng
 * khoá cũ; sau khi ghi kiểm lại bằng khoá mới, lỗi bất kỳ → huỷ toàn bộ (không xoay dở dang).
 * Không đổi `updated_at` / `revision` (nội dung bí mật không đổi). Ghi một dòng nhật ký chung.
 */
export async function rotateCredentialKey(
  prisma: PrismaClient,
  oldKey: Buffer,
  newKey: Buffer,
): Promise<{ rotated: number }> {
  if (oldKey.equals(newKey)) throw new Error('Khoá mới phải khác khoá cũ');
  return prisma.$transaction(
    async (tx) => {
      const before = await checkCredentialKey(tx, oldKey);
      if (before.failedIds.length)
        throw new Error(
          `Khoá cũ không giải mã được ${before.failedIds.length}/${before.total} bản ghi — không xoay khoá`,
        );
      const rows = await encrypted(tx);
      for (const row of rows) {
        const next = encryptWith(newKey, decryptWith(oldKey, row.passwordEnc!));
        await tx.$executeRaw`UPDATE client_credentials SET password_enc = ${next} WHERE id = ${row.id}::uuid`;
      }
      const after = await checkCredentialKey(tx, newKey);
      if (after.failedIds.length || after.total !== rows.length)
        throw new Error('Kiểm tra sau khi xoay khoá không đạt — đã huỷ');
      await tx.auditLog.create({
        data: {
          userId: null,
          action: 'ROTATE_KEY',
          entity: 'client-credentials',
          detail: { count: rows.length },
        },
      });
      return { rotated: rows.length };
    },
    { timeout: 120_000 },
  );
}
