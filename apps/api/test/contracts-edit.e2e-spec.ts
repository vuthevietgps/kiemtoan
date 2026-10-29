import { createTestContext, TestContext } from './utils/test-app';

interface EditableContract {
  id: string;
  ownerId: string | null;
  signedDate: string | null;
  endDate: string | null;
  note: string | null;
}

async function createEditableContract(ctx: TestContext): Promise<string> {
  const customer = await ctx.prisma.customer.create({
    data: {
      name: 'Edit customer',
      taxCode: '0100000099',
      ownerId: ctx.users.staff.id,
    },
  });
  const serviceType = await ctx.prisma.serviceType.create({
    data: { code: 'EDIT', name: 'Edit service' },
  });
  const response = await ctx
    .api(ctx.users.manager)
    .post('/contracts')
    .send({
      customerId: customer.id,
      ownerId: ctx.users.manager.id,
      startDate: '2026-10-01',
      signedDate: '2026-10-01',
      endDate: '2026-12-31',
      note: 'Original note',
      services: [
        { serviceTypeId: serviceType.id, quantity: 1, unitPrice: '1000000' },
      ],
    })
    .expect(201);
  return (response.body as EditableContract).id;
}

describe('Contract editing optional fields (e2e)', () => {
  let ctx: TestContext;
  let contractId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    contractId = await createEditableContract(ctx);
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('preserves omitted fields and persists explicit clearing', async () => {
    const unchanged = await ctx
      .api(ctx.users.manager)
      .patch(`/contracts/${contractId}`)
      .send({ vatRate: 8 })
      .expect(200);
    expect(unchanged.body as EditableContract).toMatchObject({
      ownerId: ctx.users.manager.id,
      signedDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      note: 'Original note',
    });
    await ctx
      .api(ctx.users.manager)
      .patch(`/contracts/${contractId}`)
      .send({ ownerId: null, signedDate: null, endDate: null, note: null })
      .expect(200);
    const detail = await ctx
      .api(ctx.users.manager)
      .get(`/contracts/${contractId}`)
      .expect(200);
    expect(detail.body as EditableContract).toMatchObject({
      ownerId: null,
      signedDate: null,
      endDate: null,
      note: null,
    });
  });

  it('rejects invalid dates', async () => {
    await ctx
      .api(ctx.users.manager)
      .patch(`/contracts/${contractId}`)
      .send({ signedDate: 'invalid', endDate: 'invalid' })
      .expect(400);
  });

  it('denies staff permission to edit (403)', async () => {
    await ctx
      .api(ctx.users.staff)
      .patch(`/contracts/${contractId}`)
      .send({ note: null })
      .expect(403);
  });

  it('hides contracts outside the manager team scope (404)', async () => {
    const outside = await ctx.prisma.customer.create({
      data: {
        name: 'Outside customer',
        taxCode: '0100000098',
        ownerId: ctx.users.staff2.id,
      },
    });
    const outsideContract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-EDIT-OUTSIDE',
        customerId: outside.id,
        startDate: new Date('2026-10-01'),
      },
    });
    await ctx
      .api(ctx.users.manager)
      .patch(`/contracts/${outsideContract.id}`)
      .send({ note: null })
      .expect(404);
  });
});
