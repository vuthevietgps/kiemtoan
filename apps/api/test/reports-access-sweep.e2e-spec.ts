import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { todayVn } from '../src/modules/reports/utils/period.util';
import { relogin } from './utils/auth-flow';
import { seedReportData } from './utils/report-fixtures';
import { createTestContext, TestContext } from './utils/test-app';

/**
 * 10-F: quét quyền và số tiền trên mọi API, file xuất của tổng quan / báo cáo (tiêu chí 2, 8). Mỗi dòng
 * là mã trả về mong đợi của Giám đốc, KTT, nhân viên, thu tiền, quản trị.
 */
type UserKey = keyof TestContext['users'];
const ROLES: UserKey[] = ['director', 'manager', 'staff', 'cashier', 'admin'];
const OPERATIONS = [200, 200, 200, 403, 403];
const OPERATIONS_EXPORT = [200, 200, 403, 403, 403];
const FINANCE = [200, 200, 403, 200, 403];

const MATRIX: [string, number[]][] = [
  ['/dashboard/operations', [200, 200, 200, 200, 403]],
  ['/dashboard/finance', FINANCE],
  ['/reports/revenue', FINANCE],
  ['/reports/revenue/export', FINANCE],
  ['/reports/revenue?format=csv', FINANCE],
  ['/reports/receivables', FINANCE],
  ['/reports/deadline-compliance', OPERATIONS],
  ['/reports/deadline-compliance/export', OPERATIONS_EXPORT],
  ['/reports/contracts', OPERATIONS],
  ['/reports/contracts/export', OPERATIONS_EXPORT],
  ['/reports/customers', OPERATIONS],
  ['/reports/customers/export', OPERATIONS_EXPORT],
  ['/reports/capability', OPERATIONS],
  ['/reports/capability/export', OPERATIONS_EXPORT],
  ['/reports/saved-filters', [200, 200, 200, 200, 403]],
];
const OPERATION_REPORTS = [
  '/dashboard/operations',
  '/reports/deadline-compliance',
  '/reports/contracts',
  '/reports/customers',
  '/reports/capability',
  '/reports/capability?role=LEAD',
  '/reports/capability?role=MANAGER',
];
const MONEY_KEYS = [
  'subtotal',
  'contractValue',
  'invoiced',
  'paid',
  'revenue',
  'amount',
  'remaining',
  'overdueAmount',
  'totalPayable',
];

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, found));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      found.add(k);
      keysOf(v, found);
    }
  return found;
}

describe('Reports access sweep (e2e)', () => {
  let ctx: TestContext;
  const year = todayVn().getUTCFullYear();
  const range = `from=${year - 1}-01-01&to=${year + 1}-12-31`;
  const withRange = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}${range}`;

  const file = async (key: UserKey, path: string) => {
    const res = await ctx
      .api(ctx.users[key])
      .get(withRange(path))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    return res.body as Buffer;
  };
  const sheetText = async (buffer: Buffer) => {
    const zip = await JSZip.loadAsync(buffer);
    const sheet = Object.keys(zip.files).find((f) =>
      f.startsWith('xl/worksheets/'),
    )!;
    return zip.file(sheet)!.async('string');
  };
  const expectNoMoney = async (key: UserKey) => {
    for (const path of OPERATION_REPORTS) {
      const res = await ctx
        .api(ctx.users[key])
        .get(withRange(path))
        .expect(200);
      const keys = keysOf(res.body);
      for (const money of MONEY_KEYS)
        expect([path, keys.has(money)]).toEqual([path, false]);
      expect(JSON.stringify(res.body)).not.toContain('1000000');
    }
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    await seedReportData(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it.each(MATRIX)('%s đúng quyền từng vai', async (path, expected) => {
    const actual: number[] = [];
    for (const key of ROLES) {
      // Hai đường dẫn này không nhận tham số kỳ.
      const noPeriod = /receivables|saved-filters/.test(path);
      const res = await ctx
        .api(ctx.users[key])
        .get(noPeriod ? path : withRange(path));
      actual.push(res.status);
    }
    expect(actual).toEqual(expected);
  });

  it('nhân viên không nhận số tiền nào trong JSON báo cáo vận hành', async () => {
    await expectNoMoney('staff');
  });

  it('KTT bị thu hồi quyền tài chính: không có tiền ở JSON lẫn Excel; có lại quyền thì có cột tiền', async () => {
    const before = await sheetText(
      await file('manager', '/reports/contracts/export'),
    );
    expect(before).toContain('Giá trị trước VAT');
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.manager.id}/access-requests`)
      .send({ role: 'MANAGER', financialAccess: false })
      .expect(201);
    await relogin(ctx, ctx.users.manager);
    await expectNoMoney('manager');
    for (const path of ['contracts', 'customers', 'deadline-compliance']) {
      const sheet = await sheetText(
        await file('manager', `/reports/${path}/export`),
      );
      expect(sheet).not.toContain('Giá trị trước VAT');
      expect(sheet).not.toContain('1000000');
    }
    expect(
      await sheetText(await file('manager', '/reports/capability/export')),
    ).not.toContain('1000000');
    await ctx.api(ctx.users.manager).get('/dashboard/finance').expect(403);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.manager.id}/access-requests`)
      .send({ role: 'MANAGER', financialAccess: null })
      .expect(201);
    await relogin(ctx, ctx.users.manager);
  });

  it('mọi file Excel mở được và có dữ liệu; số dòng HĐ khớp JSON', async () => {
    for (const path of [
      'revenue',
      'deadline-compliance',
      'contracts',
      'customers',
      'capability',
    ]) {
      const book = new ExcelJS.Workbook();
      const buffer = await file('director', `/reports/${path}/export`);
      await book.xlsx.load(buffer as unknown as ArrayBuffer);
      expect([path, book.worksheets.length]).toEqual([path, 1]);
      expect(book.worksheets[0].rowCount).toBeGreaterThan(1);
    }
    const json = await ctx
      .api(ctx.users.director)
      .get(withRange('/reports/contracts'))
      .expect(200);
    const items = (json.body as { items: { code: string }[] }).items;
    expect(items.length).toBeGreaterThan(0);
    const sheet = await sheetText(
      await file('director', '/reports/contracts/export'),
    );
    for (const item of items) expect(sheet).toContain(item.code);
  });
});
