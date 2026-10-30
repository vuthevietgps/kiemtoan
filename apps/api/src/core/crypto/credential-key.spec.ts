import { credentialKey, decryptWith, encryptWith } from './aes-gcm';
import { checkCredentialKey, rotateCredentialKey } from './credential-key';

const OLD = credentialKey('0123456789abcdef0123456789abcdef');
const NEW = credentialKey('fedcba9876543210fedcba9876543210');

/** DB giả trong bộ nhớ: đủ cho findMany / $executeRaw / auditLog / $transaction. */
function fakeDb(rows: { id: string; passwordEnc: string | null }[]) {
  const audit: unknown[] = [];
  const self: { db?: unknown } = {};
  const db = {
    clientCredential: {
      findMany: jest.fn(() =>
        Promise.resolve(
          rows.filter((r) => r.passwordEnc !== null).map((r) => ({ ...r })),
        ),
      ),
    },
    $executeRaw: jest.fn(
      (_s: TemplateStringsArray, enc: string, id: string) => {
        rows.find((r) => r.id === id)!.passwordEnc = enc;
        return Promise.resolve(1);
      },
    ),
    auditLog: {
      create: jest.fn((a: unknown) => Promise.resolve(audit.push(a))),
    },
    $transaction: jest.fn(async (run: (tx: unknown) => Promise<unknown>) => {
      const snapshot = rows.map((r) => ({ ...r }));
      try {
        return await run(self.db);
      } catch (error) {
        rows.splice(0, rows.length, ...snapshot); // rollback
        throw error;
      }
    }),
  };
  self.db = db;
  return { db, audit };
}

describe('credential-key (09, L12)', () => {
  it('khoá phải đúng 32 byte', () => {
    expect(() => credentialKey('ngan')).toThrow(/32 byte/);
    expect(() => credentialKey(undefined)).toThrow(/32 byte/);
  });

  it('check: khoá đúng → 0 lỗi; khoá sai → liệt kê id, không lộ bí mật', async () => {
    const rows = [
      { id: 'a', passwordEnc: encryptWith(OLD, 'Bi-mat-1') },
      { id: 'b', passwordEnc: encryptWith(OLD, 'Bi-mat-2') },
      { id: 'c', passwordEnc: null }, // token chưa có PIN
    ];
    const { db } = fakeDb(rows);
    await expect(checkCredentialKey(db as never, OLD)).resolves.toEqual({
      total: 2,
      failedIds: [],
    });
    const wrong = await checkCredentialKey(db as never, NEW);
    expect(wrong).toEqual({ total: 2, failedIds: ['a', 'b'] });
    expect(JSON.stringify(wrong)).not.toContain('Bi-mat');
  });

  it('rotate: mã hoá lại toàn bộ, khoá cũ hết dùng được, ghi nhật ký chung', async () => {
    const rows = [
      { id: 'a', passwordEnc: encryptWith(OLD, 'Bi-mat-1') },
      { id: 'b', passwordEnc: encryptWith(OLD, 'Bi-mat-2') },
    ];
    const { db, audit } = fakeDb(rows);
    await expect(rotateCredentialKey(db as never, OLD, NEW)).resolves.toEqual({
      rotated: 2,
    });
    expect(rows.map((r) => decryptWith(NEW, r.passwordEnc))).toEqual([
      'Bi-mat-1',
      'Bi-mat-2',
    ]);
    expect(() => decryptWith(OLD, rows[0].passwordEnc)).toThrow();
    expect(audit).toEqual([
      {
        data: expect.objectContaining({
          action: 'ROTATE_KEY',
          detail: { count: 2 },
        }) as unknown,
      },
    ]);
  });

  it('rotate: có bản ghi khoá cũ không giải mã được → không đổi gì', async () => {
    const good = encryptWith(OLD, 'Bi-mat-1');
    const rows = [
      { id: 'a', passwordEnc: good },
      { id: 'b', passwordEnc: encryptWith(NEW, 'khac-khoa') },
    ];
    const { db } = fakeDb(rows);
    await expect(rotateCredentialKey(db as never, OLD, NEW)).rejects.toThrow(
      /1\/2/,
    );
    expect(rows[0].passwordEnc).toBe(good);
    expect(db.$executeRaw).not.toHaveBeenCalled();
    await expect(rotateCredentialKey(db as never, OLD, OLD)).rejects.toThrow(
      /khác khoá cũ/,
    );
  });
});
