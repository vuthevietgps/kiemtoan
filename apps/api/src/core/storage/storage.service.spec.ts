import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { StorageService } from './storage.service';
jest.mock('node:fs', () => ({ existsSync: jest.fn(() => true) }));

describe('Storage path boundaries', () => {
  const root = resolve('uploads-test');
  const storage = new StorageService(new ConfigService({ UPLOAD_DIR: root }));
  it('rejects sibling paths sharing the root prefix', () => {
    expect(() =>
      storage.pathOf('../uploads-test-sibling/private.pdf'),
    ).toThrow();
  });
  it('accepts existing files within the root', () => {
    expect(storage.pathOf('2026/10/file.pdf')).toBe(
      resolve(root, '2026/10/file.pdf'),
    );
  });
});
