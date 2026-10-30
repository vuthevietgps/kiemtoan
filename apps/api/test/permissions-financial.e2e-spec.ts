import {
  createTestContext,
  TestContext,
  TEST_PASSWORD,
} from './utils/test-app';
import { relogin } from './utils/auth-flow';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

let ctx: TestContext;
let customerId: string;
let contractId: string;
let credentialId: string;
beforeAll(async () => {
  ctx = await createTestContext();
  const customer = await ctx.prisma.customer.create({
    data: {
      name: 'KH được giao',
      taxCode: 'PERMISSION-1',
      ownerId: ctx.users.staff.id,
    },
  });
  customerId = customer.id;
  const service = await ctx.prisma.serviceType.create({
    data: { code: 'PERM', name: 'Dịch vụ', cycle: 'MONTHLY' },
  });
  const contract = await ctx.prisma.contract.create({
    data: {
      code: 'HD-PERM',
      customerId,
      startDate: new Date('2026-10-01'),
      status: 'IN_PROGRESS',
      subtotal: '1000000',
      vatRate: '10',
      vatAmount: '100000',
      total: '1100000',
      services: {
        create: {
          serviceTypeId: service.id,
          quantity: 1,
          unitPrice: '1000000',
          amount: '1000000',
        },
      },
    },
  });
  contractId = contract.id;
  const created = await ctx
    .api(ctx.users.manager)
    .post('/client-credentials')
    .send({
      customerId,
      type: 'OTHER',
      label: 'Cổng khác',
      username: 'test',
      password: 'CustomerSecret@123',
    })
    .expect(201);
  credentialId = (created.body as { id: string }).id;
});
afterAll(async () => {
  await ctx.app.close();
});

describe('Financial fields and report categories', () => {
  it('keeps contract operations visible while removing all financial fields for staff', async () => {
    const response = await ctx
      .api(ctx.users.staff)
      .get(`/contracts/${contractId}`)
      .expect(200);
    const body = response.body as Record<string, unknown>;
    expect(body.id).toBe(contractId);
    expect(body.taskProgress).toBeDefined();
    for (const key of [
      'subtotal',
      'total',
      'vatRate',
      'vatAmount',
      'payments',
      'invoices',
      'installments',
      'remainingAmount',
      'paidAmount',
    ])
      expect(body).not.toHaveProperty(key);
    const services = body.services as Record<string, unknown>[];
    expect(services[0]).not.toHaveProperty('unitPrice');
    expect(services[0]).not.toHaveProperty('amount');
    const list = await ctx.api(ctx.users.staff).get('/contracts').expect(200);
    expect((list.body as { total: number }).total).toBe(1);
    const customer = await ctx
      .api(ctx.users.staff)
      .get(`/customers/${customerId}`)
      .expect(200);
    expect(
      (customer.body as { contracts: Record<string, unknown>[] }).contracts[0],
    ).not.toHaveProperty('total');
    const manager = await ctx
      .api(ctx.users.manager)
      .get(`/contracts/${contractId}`)
      .expect(200);
    expect((manager.body as { total: string }).total).toBe('1100000');
  });
  it('removes dashboard money and separates finance from operational report access', async () => {
    const dashboard = await ctx
      .api(ctx.users.staff)
      .get('/dashboard?from=2026-10-01&to=2026-10-31')
      .expect(200);
    const body = dashboard.body as {
      kpis: Record<string, unknown>;
      recentContracts: Record<string, unknown>[];
    };
    expect(body.kpis).toHaveProperty('contracts');
    expect(body.kpis).not.toHaveProperty('revenue');
    expect(body.kpis).not.toHaveProperty('totalPayable');
    expect(body).not.toHaveProperty('revenueByServiceType');
    expect(body).not.toHaveProperty('paymentStatus');
    expect(body.recentContracts[0]).not.toHaveProperty('total');
    for (const path of [
      '/reports/revenue',
      '/reports/receivables',
      '/reports/revenue?format=csv',
      '/invoices',
      '/payments',
    ])
      await ctx.api(ctx.users.staff).get(path).expect(403);
    for (const path of [
      '/reports/task-compliance',
      '/reports/staff-performance',
      '/reports/task-compliance?format=csv',
    ])
      await ctx.api(ctx.users.cashier).get(path).expect(403);
    await ctx.api(ctx.users.cashier).get('/reports/revenue').expect(200);
    const cashier = await ctx
      .api(ctx.users.cashier)
      .get('/dashboard')
      .expect(200);
    for (const key of ['myTasks', 'myTaskItems', 'upcoming', 'reportDeadlines'])
      expect(cashier.body as object).not.toHaveProperty(key);
    await ctx.api(ctx.users.staff).get('/reports/task-compliance').expect(200);
  });
});

describe('Financial revocation on operational exports', () => {
  it('does not leak revenue through performance JSON or CSV when finance is revoked', async () => {
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.manager.id}/access-requests`)
      .send({ role: 'MANAGER', financialAccess: false })
      .expect(201);
    await relogin(ctx, ctx.users.manager);
    const report = await ctx
      .api(ctx.users.manager)
      .get('/reports/staff-performance')
      .expect(200);
    expect(JSON.stringify(report.body)).not.toContain('revenue');
    const csv = await ctx
      .api(ctx.users.manager)
      .get('/reports/staff-performance?format=csv')
      .expect(200);
    expect(csv.text).not.toContain('Doanh thu');
    await ctx.api(ctx.users.manager).get('/reports/revenue').expect(403);
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.manager.id}/access-requests`)
      .send({ role: 'MANAGER', financialAccess: null })
      .expect(201);
    await relogin(ctx, ctx.users.manager);
  });
});

describe('Explicit secret access and recent password verification', () => {
  it('denies staff by default and requires recent confirmation even for managers', async () => {
    await ctx
      .api(ctx.users.staff)
      .post(`/client-credentials/${credentialId}/reveal`)
      .expect(403);
    const challenge = await ctx
      .api(ctx.users.manager)
      .post(`/client-credentials/${credentialId}/reveal`)
      .expect(403);
    expect((challenge.body as { code: string }).code).toBe(
      'SECRET_REAUTH_REQUIRED',
    );
    await ctx
      .api(ctx.users.manager)
      .post('/auth/verify-password')
      .send({ password: TEST_PASSWORD })
      .expect(201);
    const secret = await ctx
      .api(ctx.users.manager)
      .post(`/client-credentials/${credentialId}/reveal`)
      .expect(200);
    expect(secret.body).toEqual({ password: 'CustomerSecret@123' });
    await ctx.prisma.authSession.updateMany({
      where: { userId: ctx.users.manager.id },
      data: { secretVerifiedAt: new Date(Date.now() - 6 * 60000) },
    });
    await ctx
      .api(ctx.users.manager)
      .post(`/client-credentials/${credentialId}/reveal`)
      .expect(403);
  });
  it('honours a director grant and still rejects data outside assignment', async () => {
    await ctx
      .api(ctx.users.director)
      .post(`/users/${ctx.users.staff.id}/access-requests`)
      .send({ role: 'STAFF', secretAccess: true })
      .expect(201);
    await relogin(ctx, ctx.users.staff);
    await ctx
      .api(ctx.users.staff)
      .post('/auth/verify-password')
      .send({ password: TEST_PASSWORD })
      .expect(201);
    await ctx
      .api(ctx.users.staff)
      .post(`/client-credentials/${credentialId}/reveal`)
      .expect(200);
    const other = await ctx.prisma.customer.create({
      data: {
        name: 'Ngoài phân công',
        taxCode: 'PERMISSION-2',
        ownerId: ctx.users.staff2.id,
      },
    });
    const created = await ctx
      .api(ctx.users.director)
      .post('/client-credentials')
      .send({
        customerId: other.id,
        type: 'OTHER',
        label: 'Cổng khác',
        username: 'other',
        password: 'NeverReveal@123',
      })
      .expect(201);
    await ctx
      .api(ctx.users.staff)
      .post(`/client-credentials/${(created.body as { id: string }).id}/reveal`)
      .expect(404);
  });
});

describe('Append-only audit and XLSX export', () => {
  it('writes actions without credentials and rejects update/delete at the database layer', async () => {
    const logs = await ctx.prisma.auditLog.findMany({
      where: { action: 'VIEW_SECRET' },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain('CustomerSecret@123');
    await expect(
      ctx.prisma.auditLog.update({
        where: { id: logs[0].id },
        data: { action: 'CHANGED' },
      }),
    ).rejects.toThrow();
    await expect(
      ctx.prisma.auditLog.delete({ where: { id: logs[0].id } }),
    ).rejects.toThrow();
    await ctx.api(ctx.users.staff).get('/audit-logs').expect(403);
  });
  it('exports a real Excel workbook only with audit export permission', async () => {
    await ctx.api(ctx.users.staff).get('/audit-logs/export').expect(403);
    const exported = await ctx
      .api(ctx.users.admin)
      .get('/audit-logs/export?action=VIEW_SECRET')
      .responseType('blob')
      .expect(200);
    expect(exported.headers['content-type']).toContain('spreadsheetml.sheet');
    const buffer = exported.body as Buffer;
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(buffer.toString('utf8')).toContain('VIEW_SECRET');
    writeFileSync(
      join(process.cwd(), '../../tmp/01-audit-export.xlsx'),
      buffer,
    );
    expect(
      await ctx.prisma.auditLog.count({
        where: { action: 'EXPORT', entity: 'audit-logs' },
      }),
    ).toBeGreaterThan(0);
  });
});
