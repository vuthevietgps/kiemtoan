import {
  readCustomerWorkbook,
  writeCustomerWorkbook,
} from '../src/modules/customers/customer-workbook.util';
import { createTestContext, TestContext } from './utils/test-app';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.app.close();
});
const row = (name: string, taxCode: string, ownerEmail = '') => [
  name,
  taxCode,
  '',
  '',
  '',
  'MONTHLY',
  'ACTIVE',
  '',
  '0900123456',
  '',
  ownerEmail,
  '',
];

it('previews row errors without writing and imports only explicitly selected valid rows', async () => {
  const file = await writeCustomerWorkbook([
    row('Valid customer', '0001234567'),
    row('Invalid customer', '123'),
  ]);
  const preview = await ctx
    .api(ctx.users.manager)
    .post('/customers/imports/preview')
    .attach('file', file, 'customers.xlsx')
    .expect(201);
  const body = preview.body as {
    id: string;
    validCount: number;
    invalidCount: number;
    rows: { row: number; errors: string[] }[];
  };
  expect(body.validCount).toBe(1);
  expect(body.invalidCount).toBe(1);
  expect(body.rows[1].row).toBe(3);
  expect(body.rows[1].errors.length).toBeGreaterThan(0);
  expect(await ctx.prisma.customer.count()).toBe(0);
  await ctx
    .api(ctx.users.manager)
    .post(`/customers/imports/${body.id}/confirm`)
    .send({ rows: [3] })
    .expect(400);
  const confirmed = await ctx
    .api(ctx.users.manager)
    .post(`/customers/imports/${body.id}/confirm`)
    .send({ rows: [2] })
    .expect(201);
  expect((confirmed.body as { count: number }).count).toBe(1);
  expect(
    await ctx.prisma.customer.findUnique({
      where: { taxCode: '0001234567' },
    }),
  ).toMatchObject({
    ownerId: ctx.users.manager.id,
    contactPhone: '0900123456',
  });
  await ctx
    .api(ctx.users.manager)
    .post(`/customers/imports/${body.id}/confirm`)
    .send({ rows: [2] })
    .expect(409);
  expect(await ctx.prisma.customer.count()).toBe(1);
});

it('does not allow another account to confirm a preview', async () => {
  const preview = await ctx
    .api(ctx.users.director)
    .post('/customers/imports/preview')
    .attach(
      'file',
      await writeCustomerWorkbook([row('Private batch', '0001234568')]),
      'customers.xlsx',
    )
    .expect(201);
  await ctx
    .api(ctx.users.manager)
    .post(`/customers/imports/${(preview.body as { id: string }).id}/confirm`)
    .send({ rows: [2] })
    .expect(404);
});

it('rechecks duplicates at confirmation and rolls back the whole selection', async () => {
  const preview = await ctx
    .api(ctx.users.director)
    .post('/customers/imports/preview')
    .attach(
      'file',
      await writeCustomerWorkbook([
        row('Conflict', '0001234569'),
        row('Atomic', '0001234570'),
      ]),
      'customers.xlsx',
    )
    .expect(201);
  await ctx.prisma.customer.create({
    data: { name: 'Created meanwhile', taxCode: '0001234569' },
  });
  await ctx
    .api(ctx.users.director)
    .post(`/customers/imports/${(preview.body as { id: string }).id}/confirm`)
    .send({ rows: [2, 3] })
    .expect(409);
  expect(
    await ctx.prisma.customer.findUnique({
      where: { taxCode: '0001234570' },
    }),
  ).toBeNull();
});

it('flags duplicate rows and owners outside the managed team', async () => {
  const preview = await ctx
    .api(ctx.users.manager)
    .post('/customers/imports/preview')
    .attach(
      'file',
      await writeCustomerWorkbook([
        row('One', '0001234571'),
        row('Two', '0001234571'),
        row('Outside team', '0001234572', ctx.users.staff2.email),
      ]),
      'customers.xlsx',
    )
    .expect(201);
  const body = preview.body as { validCount: number; invalidCount: number };
  expect(body.validCount).toBe(0);
  expect(body.invalidCount).toBe(3);
});

describe('Customer spreadsheet access', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  it('denies staff import and limits staff export to assigned customers', async () => {
    await ctx
      .api(ctx.users.staff)
      .get('/customers/import-template')
      .expect(403);
    await ctx
      .api(ctx.users.staff)
      .post('/customers/imports/preview')
      .expect(403);
    await ctx.prisma.customer.create({
      data: {
        name: 'Visible',
        taxCode: '0001234573',
        ownerId: ctx.users.staff.id,
      },
    });
    await ctx.prisma.customer.create({
      data: {
        name: 'Hidden',
        taxCode: '0001234574',
        ownerId: ctx.users.staff2.id,
      },
    });
    const exported = await ctx
      .api(ctx.users.staff)
      .get('/customers/export')
      .responseType('blob')
      .expect(200);
    expect(
      (await readCustomerWorkbook(exported.body as Buffer)).map(
        (row) => row[0],
      ),
    ).toEqual(['Visible']);
  });
});
