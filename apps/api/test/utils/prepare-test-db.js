// Apply versioned migrations only to an isolated e2e database.
const { execFileSync } = require('node:child_process');

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://ketoan:ketoan_dev@localhost:5433/ketoan_test';
const databaseName = decodeURIComponent(new URL(url).pathname.slice(1));

if (
  !databaseName.endsWith('_test') &&
  !databaseName.startsWith('ketoan_codex_')
) {
  throw new Error('TEST_DATABASE_URL must name an isolated test database.');
}

execFileSync(
  process.execPath,
  [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  },
);
