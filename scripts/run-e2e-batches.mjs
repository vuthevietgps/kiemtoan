#!/usr/bin/env node
// Chạy e2e API theo từng lô nhỏ, tuần tự, nghỉ giữa các lô — tránh làm máy quá tải/treo.
// Dùng: node scripts/run-e2e-batches.mjs [--size 5] [--pause 5] [--limit 10] [từ khoá tên file...]
// Cần TEST_DATABASE_URL như khi chạy `npm run test:e2e` trong apps/api. Bộ phân quyền (nhẹ) chạy riêng: `npm run test:access`.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const [, value] = args.splice(index, 2);
  return value;
};
const size = Number(option('size', '5'));
const pause = Number(option('pause', '5'));
// Một lô quá thời hạn (phút) thì bị dừng — Jest treo không giữ máy mãi.
const limit = Number(option('limit', '10'));
const filters = args;

const files = readdirSync(join(apiDir, 'test'))
  .filter((f) => f.endsWith('.e2e-spec.ts'))
  .filter((f) => !filters.length || filters.some((k) => f.includes(k)))
  .sort();
if (!files.length) {
  console.error('Không có file test nào khớp.');
  process.exit(1);
}

const batches = [];
for (let i = 0; i < files.length; i += size) batches.push(files.slice(i, i + size));
console.log(`${files.length} file, ${batches.length} lô (mỗi lô tối đa ${size}), nghỉ ${pause}s giữa các lô`);

const sleep = (seconds) => spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${seconds * 1000})`]);
const results = [];
for (const [index, batch] of batches.entries()) {
  console.log(`\n=== Lô ${index + 1}/${batches.length}: ${batch.join(', ')}`);
  const run = spawnSync(
    'npx',
    [
      'jest',
      '--config',
      './test/jest-e2e.json',
      '--runInBand',
      // Thoát ngay khi chạy xong dù còn kết nối/hẹn giờ chưa đóng (nguyên nhân treo máy 29/10).
      '--forceExit',
      ...batch.map((f) => `test/${f}`),
    ],
    { cwd: apiDir, stdio: 'inherit', shell: true, timeout: limit * 60_000 },
  );
  if (run.error) console.error(`Lô ${index + 1} dừng: ${run.error.message}`);
  results.push({ batch: index + 1, ok: run.status === 0 });
  if (index < batches.length - 1 && pause > 0) sleep(pause);
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\nKết quả: ${results.length - failed.length}/${results.length} lô đạt` +
    (failed.length ? `; lô lỗi: ${failed.map((r) => r.batch).join(', ')}` : ''),
);
process.exit(failed.length ? 1 : 0);
