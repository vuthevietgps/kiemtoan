/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- res.body của supertest có kiểu any */
import { ContractStatus } from '@prisma/client';
import { createTestContext, TestContext } from './utils/test-app';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const PDF = Buffer.from('%PDF-1.4\nhoa don GTGT\n%%EOF');
const XML = Buffer.from('<?xml version="1.0"?><HDon><DLHDon/></HDon>');

/**
 * 08-B (K1–K9): sổ hoá đơn nội bộ — đề nghị theo đợt / giá trị (không vượt phần chưa xuất), người mua
 * chụp từ KH, ghi nhận xuất kèm PDF/XML, chặn trùng số, đồng thời 409, điều chỉnh tăng/giảm, thay thế,
 * huỷ đề nghị, lịch sử, quyền.
 * HĐ 10.000.000 + VAT 10% = 11.000.000; đợt 1 = 5.500.000, đợt 2 = 5.500.000.
 */
describe('08-B sổ hoá đơn (e2e)', () => {
  let ctx: TestContext;
  let contractId: string;
  let customerId: string;
  const ids: Record<string, string> = {};
  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const detail = async (id: string) =>
    (await as('director').get(`/invoices/${id}`).expect(200)).body;
  const identity = (number: string, extra: Record<string, string> = {}) => ({
    templateCode: '1',
    symbol: 'c25taa',
    number,
    issueDate: '2026-10-20',
    ...extra,
  });
  const withFiles = (
    who: keyof TestContext['users'],
    path: string,
    fields: Record<string, string>,
    files: { pdf?: boolean; xml?: boolean } = { pdf: true },
  ) => {
    const req = as(who).post(path);
    for (const [k, v] of Object.entries(fields)) void req.field(k, v);
    if (files.pdf) void req.attach('pdf', PDF, 'hoa-don.pdf');
    if (files.xml) void req.attach('xml', XML, 'hoa-don.xml');
    return req;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Người Mua',
          taxCode: '0100008001',
          address: '1 Tràng Tiền, Hà Nội',
          contactEmail: 'ketoan@nguoimua.vn',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    const contract = await ctx.prisma.contract.create({
      data: {
        code: 'HD-2026-T08B',
        customerId,
        status: ContractStatus.IN_PROGRESS,
        startDate: d('2026-01-01'),
        subtotal: '10000000',
        vatRate: 10,
        vatAmount: '1000000',
        total: '11000000',
        installments: {
          create: [
            {
              name: 'Đợt 1',
              amount: '5500000',
              dueDate: d('2026-03-31'),
              sortOrder: 1,
            },
            {
              name: 'Đợt 2',
              amount: '5500000',
              dueDate: d('2026-09-30'),
              sortOrder: 2,
            },
          ],
        },
      },
      include: { installments: true },
    });
    contractId = contract.id;
    for (const i of contract.installments) ids[i.name] = i.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('đề nghị theo đợt: tiền = tổng đợt (gồm VAT), người mua chụp từ KH; đợt đã có đề nghị → 400', async () => {
    const res = await as('manager')
      .post('/invoices')
      .send({ contractId, installmentIds: [ids['Đợt 1']] })
      .expect(201);
    ids.first = res.body.id;
    expect(res.body).toMatchObject({
      status: 'REQUESTED',
      kind: 'ORIGINAL',
      subtotal: '5000000',
      vatAmount: '500000',
      total: '5500000',
      buyerName: 'Công ty Người Mua',
      buyerTaxCode: '0100008001',
      buyerEmail: 'ketoan@nguoimua.vn',
      installments: [{ installment: { id: ids['Đợt 1'] } }],
      events: [{ toStatus: 'REQUESTED' }],
    });
    await as('manager')
      .post('/invoices')
      .send({ contractId, installmentIds: [ids['Đợt 1']] })
      .expect(400);
  });

  it('đề nghị theo giá trị không vượt phần chưa xuất (tính cả đề nghị đang chờ); sửa người mua; huỷ đề nghị cần lý do', async () => {
    await as('cashier')
      .post('/invoices')
      .send({ contractId, subtotal: '5000001' })
      .expect(400);
    const res = await as('cashier')
      .post('/invoices')
      .send({ contractId, subtotal: '1000000', buyerName: 'Tên khác' })
      .expect(201);
    expect(res.body).toMatchObject({ buyerName: 'Tên khác', total: '1100000' });
    const updated = await as('cashier')
      .patch(`/invoices/${res.body.id}`)
      .send({ revision: 1, buyerName: 'Công ty Người Mua (CN HN)' })
      .expect(200);
    expect(updated.body).toMatchObject({
      revision: 2,
      buyerName: 'Công ty Người Mua (CN HN)',
    });
    await as('cashier')
      .post(`/invoices/${res.body.id}/cancel`)
      .send({ revision: 2, reason: 'x' })
      .expect(400);
    const cancelled = await as('cashier')
      .post(`/invoices/${res.body.id}/cancel`)
      .send({ revision: 2, reason: 'Khách đề nghị gộp vào đợt 2' })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    const contract = await as('director')
      .get(`/contracts/${contractId}`)
      .expect(200);
    expect(contract.body.invoicedSubtotal).toBe('5000000');
  });

  it('ghi nhận xuất: thiếu PDF → 400; xuất kèm PDF + XML vào kho hồ sơ nhóm Hoá đơn; đồng thời → 409; trùng số → 409; KTT không ghi nhận được', async () => {
    const path = `/invoices/${ids.first}/issue`;
    await withFiles('manager', path, {
      revision: '1',
      ...identity('0000101'),
    }).expect(403);
    await withFiles(
      'cashier',
      path,
      { revision: '1', ...identity('0000101') },
      {},
    ).expect(400);
    await withFiles('cashier', path, {
      revision: '1',
      ...identity('0000101', { issueDate: '2099-01-01' }),
    }).expect(400);
    const results = await Promise.all([
      withFiles(
        'cashier',
        path,
        { revision: '1', ...identity('0000101') },
        { pdf: true, xml: true },
      ),
      withFiles('director', path, { revision: '1', ...identity('0000101') }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const issued = await detail(ids.first);
    expect(issued).toMatchObject({
      status: 'ISSUED',
      templateCode: '1',
      symbol: 'C25TAA',
      number: '0000101',
    });
    expect(issued.events.map((e: { toStatus: string }) => e.toStatus)).toEqual([
      'REQUESTED',
      'ISSUED',
    ]);
    const docs = await ctx.prisma.document.findMany({
      where: { id: { in: issued.documents.map((x: { id: string }) => x.id) } },
      select: { category: true, contractId: true, deletedAt: true },
    });
    expect(docs.filter((x) => !x.deletedAt)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'INVOICE', contractId }),
      ]),
    );
    const dup = await as('cashier')
      .post('/invoices')
      .send({ contractId, installmentIds: [ids['Đợt 2']] })
      .expect(201);
    ids.second = dup.body.id;
    await withFiles('cashier', `/invoices/${dup.body.id}/issue`, {
      revision: '1',
      ...identity('0000101', { symbol: 'C25TAA ' }),
    }).expect(409);
    await withFiles('cashier', `/invoices/${dup.body.id}/issue`, {
      revision: '1',
      ...identity('0000102'),
    }).expect(200);
    await as('cashier')
      .post(`/invoices/${ids.first}/cancel`)
      .send({ revision: 2, reason: 'Huỷ hoá đơn đã xuất' })
      .expect(400);
  });

  it('điều chỉnh: tăng vượt giá trị HĐ → 400; giảm 1.000.000 → hoá đơn gốc Đã điều chỉnh, giá trị hiệu lực giảm; giảm quá giá trị gốc → 400', async () => {
    const original = await detail(ids.first);
    await withFiles('cashier', `/invoices/${ids.first}/adjust`, {
      revision: String(original.revision),
      ...identity('0000103'),
      direction: 'INCREASE',
      subtotal: '1',
      reason: 'Tăng thử vượt giá trị',
    }).expect(400);
    const adj = await withFiles('cashier', `/invoices/${ids.first}/adjust`, {
      revision: String(original.revision),
      ...identity('0000103'),
      direction: 'DECREASE',
      subtotal: '1000000',
      reason: 'Giảm giá theo biên bản',
    }).expect(201);
    expect(adj.body).toMatchObject({
      kind: 'ADJUSTMENT',
      status: 'ISSUED',
      subtotal: '-1000000',
      vatAmount: '-100000',
      total: '-1100000',
      related: { id: ids.first },
    });
    const adjusted = await detail(ids.first);
    expect(adjusted).toMatchObject({ status: 'ADJUSTED' });
    expect(adjusted.derived.map((x: { kind: string }) => x.kind)).toEqual([
      'ADJUSTMENT',
    ]);
    await withFiles('cashier', `/invoices/${ids.first}/adjust`, {
      revision: String(adjusted.revision),
      ...identity('0000104'),
      direction: 'DECREASE',
      subtotal: '4000001',
      reason: 'Giảm quá giá trị còn lại',
    }).expect(400);
    const contract = await as('director')
      .get(`/contracts/${contractId}`)
      .expect(200);
    expect(contract.body.invoicedSubtotal).toBe('9000000');
  });

  it('thay thế: hoá đơn gốc Bị thay thế, đợt chuyển sang hoá đơn mới; hoá đơn đã điều chỉnh không thay thế được', async () => {
    const adjusted = await detail(ids.first);
    await withFiles('cashier', `/invoices/${ids.first}/replace`, {
      revision: String(adjusted.revision),
      ...identity('0000105'),
      subtotal: '5000000',
      reason: 'Sai tên người mua',
    }).expect(400);
    const second = await detail(ids.second);
    const rep = await withFiles('cashier', `/invoices/${ids.second}/replace`, {
      revision: String(second.revision),
      ...identity('0000106'),
      subtotal: '5000000',
      reason: 'Sai địa chỉ người mua',
      buyerAddress: '2 Tràng Tiền, Hà Nội',
    }).expect(201);
    expect(rep.body).toMatchObject({
      kind: 'REPLACEMENT',
      status: 'ISSUED',
      total: '5500000',
      buyerAddress: '2 Tràng Tiền, Hà Nội',
      installments: [{ installment: { id: ids['Đợt 2'] } }],
    });
    expect((await detail(ids.second)).status).toBe('REPLACED');
    const contract = await as('director')
      .get(`/contracts/${contractId}`)
      .expect(200);
    expect(contract.body.invoicedSubtotal).toBe('9000000');
    const list = await as('cashier')
      .get('/invoices')
      .query({ contractId, status: 'REPLACED' })
      .expect(200);
    expect(list.body.items.map((x: { id: string }) => x.id)).toEqual([
      ids.second,
    ]);
  });

  it('quyền: nhân viên, quản trị không xem / đề nghị; KTT đề nghị được nhưng không huỷ / ghi nhận', async () => {
    for (const who of ['staff', 'admin'] as const) {
      await as(who).get('/invoices').expect(403);
      await as(who)
        .post('/invoices')
        .send({ contractId, subtotal: '1' })
        .expect(403);
    }
    const res = await as('manager')
      .post('/invoices')
      .send({ contractId, subtotal: '100000' })
      .expect(201);
    await as('manager')
      .post(`/invoices/${res.body.id}/cancel`)
      .send({ revision: 1, reason: 'KTT không có quyền huỷ' })
      .expect(403);
  });
});
