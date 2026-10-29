import request from 'supertest';
import { createTestContext, TestContext } from './utils/test-app';

let ctx: TestContext;
let customerId: string;
let documentId: string;

beforeAll(async () => {
  ctx = await createTestContext();
  const customer = await ctx.prisma.customer.create({
    data: {
      name: 'Công ty CP ABC',
      taxCode: '0101234567',
      ownerId: ctx.users.staff.id,
    },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await ctx.app.close();
});

describe('Hồ sơ tài liệu', () => {
  it('nhân viên phụ trách tải lên tài liệu', async () => {
    const res = await ctx
      .api(ctx.users.staff)
      .post(`/customers/${customerId}/documents`)
      .field('category', 'LEGAL')
      .field('note', 'Giấy phép kinh doanh')
      .attach(
        'file',
        Buffer.from('%PDF-1.4\nnoi dung giay phep\n%%EOF'),
        'giay-phep.pdf',
      )
      .expect(201);
    const body = res.body as {
      id: string;
      fileName: string;
      uploadedBy: { fullName: string };
    };
    documentId = body.id;
    expect(body.fileName).toBe('giay-phep.pdf');
    expect(body.uploadedBy.fullName).toBe('Test staff');
  });

  it('danh sách lọc theo thư mục', async () => {
    const legal = await ctx
      .api(ctx.users.staff)
      .get(`/customers/${customerId}/documents?category=LEGAL`)
      .expect(200);
    expect((legal.body as { items: unknown[] }).items).toHaveLength(1);
    const other = await ctx
      .api(ctx.users.staff)
      .get(`/customers/${customerId}/documents?category=OTHER`)
      .expect(200);
    expect((other.body as { items: unknown[] }).items).toHaveLength(0);
  });

  it('tải file về qua ?token= với tên gốc', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(
        `/api/v1/documents/${documentId}/download?token=${ctx.users.staff.token}`,
      )
      .expect(200);
    expect((res.body as Buffer).toString()).toBe(
      '%PDF-1.4\nnoi dung giay phep\n%%EOF',
    );
    expect(res.headers['content-disposition']).toContain('giay-phep.pdf');
  });

  it('nhân viên khác không tải được (404) và không xoá được (403)', async () => {
    await ctx
      .api(ctx.users.staff2)
      .get(`/documents/${documentId}/download`)
      .expect(404);
    await ctx
      .api(ctx.users.staff)
      .delete(`/documents/${documentId}`)
      .expect(403);
  });

  it('kế toán trưởng xoá mềm tài liệu', async () => {
    await ctx
      .api(ctx.users.manager)
      .delete(`/documents/${documentId}`)
      .expect(200);
    const res = await ctx
      .api(ctx.users.staff)
      .get(`/customers/${customerId}/documents`)
      .expect(200);
    expect((res.body as { items: unknown[] }).items).toHaveLength(0);
  });
});
