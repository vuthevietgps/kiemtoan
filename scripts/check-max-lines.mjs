// Kiểm tra quy tắc: mỗi file code không quá 1.000 dòng (docs/quy-tac-code.md, mục 2).
// Cách dùng: node scripts/check-max-lines.mjs [thư-mục-gốc]
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const MAX_LINES = 1000;
const WARN_LINES = 800;
const EXTENSIONS = new Set(['.ts', '.html', '.scss', '.prisma', '.sql', '.js', '.mjs']);
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'coverage', 'tmp', '.git', '.nx', '.angular', 'migrations',
]);

const root = process.argv[2] ?? process.cwd();

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
    } else if (EXTENSIONS.has(extname(entry.name))) {
      yield join(dir, entry.name);
    }
  }
}

function countLines(file) {
  const text = readFileSync(file, 'utf8');
  if (text.length === 0) return 0;
  const lines = text.split(/\r?\n/).length;
  return text.endsWith('\n') ? lines - 1 : lines;
}

const errors = [];
const warnings = [];
for (const file of walk(root)) {
  const lines = countLines(file);
  const name = relative(root, file);
  if (lines > MAX_LINES) errors.push(`${name}: ${lines} dòng`);
  else if (lines > WARN_LINES) warnings.push(`${name}: ${lines} dòng`);
}

if (warnings.length) {
  console.warn(`Cảnh báo – trên ${WARN_LINES} dòng, nên tách trước khi thêm code:`);
  warnings.forEach((w) => console.warn(`  ${w}`));
}
if (errors.length) {
  console.error(`Lỗi – vượt giới hạn ${MAX_LINES} dòng:`);
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}
console.log(`OK – không file nào vượt ${MAX_LINES} dòng.`);
