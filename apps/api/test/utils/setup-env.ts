// e2e test chạy trên database riêng (mặc định ketoan_test), không đụng dữ liệu demo.
// Có thể đổi bằng biến TEST_DATABASE_URL.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://ketoan:ketoan_dev@localhost:5433/ketoan_test';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.UPLOAD_DIR = 'uploads-test';
process.env.SMTP_HOST = ''; // Never deliver real account emails from e2e tests.
process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef';
process.env.CREDENTIAL_KEY ??= '0123456789abcdef0123456789abcdef';
