import { createTestContext, TestContext } from './utils/test-app';

let ctx: TestContext;
let customerId: string;
let documentId: string;
const original = Buffer.from('%PDF-1.4\noriginal\n%%EOF');
beforeAll(async () => {
  ctx = await createTestContext();
  const customer = await ctx.prisma.customer.create({
    data: {
      name: 'Version customer',
      taxCode: '0001234567',
      ownerId: ctx.users.staff.id,
    },
  });
  customerId = customer.id;
  const uploaded = await ctx
    .api(ctx.users.staff)
    .post(`/customers/${customerId}/documents`)
    .field('category', 'LEGAL')
    .attach('file', original, 'original.pdf')
    .expect(201);
  documentId = (uploaded.body as { id: string }).id;
});
afterAll(async () => {
  await ctx.app.close();
});

it('serializes concurrent versions and preserves original bytes', async () => {
  const upload = (name: string) =>
    ctx
      .api(ctx.users.staff)
      .post(`/documents/${documentId}/versions`)
      .attach('file', Buffer.from(`%PDF-1.4\n${name}\n%%EOF`), `${name}.pdf`);
  const responses = await Promise.all([upload('second'), upload('third')]);
  expect(responses.map((response) => response.status)).toEqual([201, 201]);
  expect(
    responses
      .map((response) => (response.body as { version: number }).version)
      .sort(),
  ).toEqual([2, 3]);
  const history = await ctx
    .api(ctx.users.staff)
    .get(`/documents/${documentId}/versions?pageSize=2`)
    .expect(200);
  expect((history.body as { total: number }).total).toBe(3);
  expect(
    (history.body as { items: { version: number }[] }).items.map(
      (item) => item.version,
    ),
  ).toEqual([3, 2]);
  const first = await ctx
    .api(ctx.users.staff)
    .get(`/documents/${documentId}/versions/1/download`)
    .responseType('blob')
    .expect(200);
  expect(first.body).toEqual(original);
});

it('previews through authentication with canonical MIME and hardened headers', async () => {
  const preview = await ctx
    .api(ctx.users.staff)
    .get(`/documents/${documentId}/versions/1/preview`)
    .responseType('blob')
    .expect(200);
  expect(preview.headers['content-type']).toContain('application/pdf');
  expect(preview.headers['x-content-type-options']).toBe('nosniff');
  expect(preview.headers['content-security-policy']).toBe('sandbox');
  expect(preview.body).toEqual(original);
  await ctx
    .api(ctx.users.staff2)
    .get(`/documents/${documentId}/versions/1/preview`)
    .expect(404);
});

it('rejects HTML, mismatched content and path-like names', async () => {
  for (const name of ['payload.html', 'fake.pdf']) {
    await ctx
      .api(ctx.users.staff)
      .post(`/customers/${customerId}/documents`)
      .field('category', 'LEGAL')
      .attach('file', Buffer.from('<script>alert(1)</script>'), name)
      .expect(400);
  }
  const result = await ctx
    .api(ctx.users.staff)
    .get(`/customers/${customerId}/documents?search=original&pageSize=1`)
    .expect(200);
  expect((result.body as { items: unknown[] }).items).toHaveLength(0);
  const all = await ctx
    .api(ctx.users.staff)
    .get(`/customers/${customerId}/documents?pageSize=1`)
    .expect(200);
  expect((all.body as { total: number }).total).toBe(1);
});

it('hides all historical versions after soft deletion', async () => {
  await ctx
    .api(ctx.users.manager)
    .delete(`/documents/${documentId}`)
    .expect(200);
  await ctx
    .api(ctx.users.staff)
    .get(`/documents/${documentId}/versions`)
    .expect(404);
  await ctx
    .api(ctx.users.staff)
    .get(`/documents/${documentId}/versions/1/download`)
    .expect(404);
  expect(
    await ctx.prisma.documentVersion.count({ where: { documentId } }),
  ).toBe(3);
});
