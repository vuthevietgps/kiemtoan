import { createTestContext, TestContext } from './utils/test-app';

let ctx: TestContext;
let customerId: string;
beforeAll(async () => {
  ctx = await createTestContext();
  const response = await ctx
    .api(ctx.users.director)
    .post('/customers')
    .send({
      name: 'Relationships customer',
      taxCode: '0012345678',
      ownerId: ctx.users.director.id,
      contactName: 'Legacy contact',
      contactEmail: 'legacy@example.test',
    })
    .expect(201);
  customerId = (response.body as { id: string }).id;
});
afterAll(async () => {
  await ctx.app.close();
});

it('does not let a manager assign an owner from another team', async () => {
  await ctx
    .api(ctx.users.manager)
    .post('/customers')
    .send({
      name: 'Unauthorized owner',
      taxCode: '0012345679',
      ownerId: ctx.users.director.id,
    })
    .expect(400);
});

it('preserves legacy contact as the primary contact', async () => {
  const response = await ctx
    .api(ctx.users.director)
    .get(`/customers/${customerId}/contacts`)
    .expect(200);
  expect((response.body as { items: unknown[] }).items).toEqual([
    expect.objectContaining({
      fullName: 'Legacy contact',
      email: 'legacy@example.test',
      isPrimary: true,
    }),
  ]);
});

it('grants scoped read access after direct assignment and removes it on unassignment', async () => {
  await ctx.api(ctx.users.staff).get(`/customers/${customerId}`).expect(404);
  const assigned = await ctx
    .api(ctx.users.director)
    .post(`/customers/${customerId}/assignments`)
    .send({ userId: ctx.users.staff.id, note: 'Tax support' })
    .expect(201);
  await ctx.api(ctx.users.staff).get(`/customers/${customerId}`).expect(200);
  const options = await ctx
    .api(ctx.users.staff)
    .get('/customers/options')
    .expect(200);
  expect(options.body).toContainEqual(
    expect.objectContaining({ id: customerId }),
  );
  await ctx
    .api(ctx.users.staff)
    .post(`/customers/${customerId}/assignments`)
    .send({ userId: ctx.users.staff2.id })
    .expect(403);
  await ctx
    .api(ctx.users.director)
    .delete(
      `/customers/${customerId}/assignments/${(assigned.body as { id: string }).id}`,
    )
    .expect(200);
  await ctx.api(ctx.users.staff).get(`/customers/${customerId}`).expect(404);
});

it('rejects inactive assignees and retains no relationship', async () => {
  await ctx.prisma.user.update({
    where: { id: ctx.users.staff2.id },
    data: { isActive: false },
  });
  await ctx
    .api(ctx.users.director)
    .post(`/customers/${customerId}/assignments`)
    .send({ userId: ctx.users.staff2.id })
    .expect(400);
  await ctx.prisma.user.update({
    where: { id: ctx.users.staff2.id },
    data: { isActive: true },
  });
});

it('serializes primary changes and synchronizes legacy fields', async () => {
  const add = (fullName: string) =>
    ctx
      .api(ctx.users.director)
      .post(`/customers/${customerId}/contacts`)
      .send({ fullName, isPrimary: true });
  const responses = await Promise.all([
    add('First contact'),
    add('Second contact'),
  ]);
  expect(responses.map((r) => r.status)).toEqual([201, 201]);
  const response = await ctx
    .api(ctx.users.director)
    .get(`/customers/${customerId}/contacts`)
    .expect(200);
  const contacts = (
    response.body as {
      items: { id: string; fullName: string; isPrimary: boolean }[];
    }
  ).items;
  const primary = contacts.filter((c) => c.isPrimary);
  expect(primary).toHaveLength(1);
  const detail = await ctx
    .api(ctx.users.director)
    .get(`/customers/${customerId}`)
    .expect(200);
  expect((detail.body as { contactName: string }).contactName).toBe(
    primary[0].fullName,
  );
  await ctx
    .api(ctx.users.director)
    .delete(`/customers/${customerId}/contacts/${primary[0].id}`)
    .expect(200);
  const cleared = await ctx
    .api(ctx.users.director)
    .get(`/customers/${customerId}`)
    .expect(200);
  expect(
    (cleared.body as { contactName: string | null }).contactName,
  ).toBeNull();
});
