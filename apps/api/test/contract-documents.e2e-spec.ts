/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- res.body của supertest có kiểu any */
import JSZip from 'jszip';
import {
  buildDocx,
  sampleTemplate,
} from '../src/modules/contracts/commercial-documents/sample-template.util';
import { createTestContext, TestContext } from './utils/test-app';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function docxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

describe('Commercial documents and Word templates (e2e)', () => {
  let ctx: TestContext;
  let customerId: string;
  let serviceTypeId: string;
  let quotationTemplate: string;
  let contractId: string;

  const as = (who: keyof TestContext['users']) => ctx.api(ctx.users[who]);
  const uploadTemplate = (
    who: keyof TestContext['users'],
    file: Buffer,
    fields: Record<string, string>,
    name = 'mau.docx',
  ) => {
    const request = as(who)
      .post('/document-templates')
      .attach('file', file, name);
    for (const [key, value] of Object.entries(fields))
      void request.field(key, value);
    return request;
  };
  const download = (documentId: string, version: number) =>
    as('director')
      .get(`/documents/${documentId}/versions/${version}/download`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
  const newContract = async () => {
    const res = await as('manager')
      .post('/contracts')
      .send({
        customerId,
        startDate: '2026-11-02',
        vatRate: 10,
        services: [
          {
            serviceTypeId,
            period: '2026',
            quantity: 12,
            unitPrice: '1000000',
          },
        ],
      })
      .expect(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    serviceTypeId = (
      await ctx.prisma.serviceType.create({
        data: { code: 'KTT', name: 'Kế toán thuế' },
      })
    ).id;
    customerId = (
      await ctx.prisma.customer.create({
        data: {
          name: 'Công ty Hồ sơ',
          taxCode: '0100000777',
          legalRep: 'Lê Văn C',
          ownerId: ctx.users.staff.id,
        },
      })
    ).id;
    contractId = await newContract();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('chỉ giám đốc quản lý mẫu; nhân viên xem danh sách, quản trị bị chặn', async () => {
    const file = await sampleTemplate('QUOTATION');
    for (const who of ['manager', 'staff', 'cashier', 'admin'] as const)
      await uploadTemplate(who, file, {
        type: 'QUOTATION',
        name: 'Báo giá',
      }).expect(403);
    const created = await uploadTemplate('director', file, {
      type: 'QUOTATION',
      name: 'Báo giá chuẩn',
    }).expect(201);
    quotationTemplate = created.body.id;
    expect(created.body).toMatchObject({ version: 1, isActive: true });
    expect(created.body.fields).toContain('contract.totalInWords');

    await as('staff').get('/document-templates').expect(200);
    await as('admin').get('/document-templates').expect(403);
    for (const who of ['manager', 'staff', 'cashier', 'admin'] as const) {
      await as(who)
        .patch(`/document-templates/${quotationTemplate}`)
        .send({ isActive: false })
        .expect(403);
      await as(who)
        .get('/document-templates/samples/CONTRACT/download')
        .expect(403);
    }
    await as('director')
      .get('/document-templates/samples/CONTRACT/download')
      .expect(200)
      .expect('Content-Disposition', /attachment/);
    const audit = await ctx.prisma.auditLog.count({
      where: { action: 'TEMPLATE_UPLOAD', entityId: quotationTemplate },
    });
    expect(audit).toBe(1);
  });

  it('chặn mẫu có trường ngoài danh sách, file không phải Word hoặc có macro', async () => {
    const bad = await buildDocx([{ paragraph: '{{customer.password}}' }]);
    const res = await uploadTemplate('director', bad, {
      type: 'CONTRACT',
      name: 'Sai trường',
    }).expect(400);
    expect(res.body.message).toContain('customer.password');
    await uploadTemplate(
      'director',
      PDF,
      { type: 'CONTRACT', name: 'PDF' },
      'mau.pdf',
    ).expect(400);
    const zip = await JSZip.loadAsync(await sampleTemplate('CONTRACT'));
    const types = await zip.file('[Content_Types].xml')!.async('string');
    zip.file(
      '[Content_Types].xml',
      types.replace(
        '</Types>',
        '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>',
      ),
    );
    zip.file('word/vbaProject.bin', 'macro');
    const macro = await zip.generateAsync({ type: 'nodebuffer' });
    await uploadTemplate(
      'director',
      macro,
      { type: 'CONTRACT', name: 'Macro' },
      'mau.docm.docx',
    ).expect(400);
    expect(await ctx.prisma.documentTemplate.count()).toBe(1);
  });

  it('tạo báo giá DOCX ở HĐ Nháp, lưu kho hồ sơ nhóm Hợp đồng, tạo lại thành phiên bản mới', async () => {
    const first = await as('manager')
      .post(`/contracts/${contractId}/documents/generate`)
      .send({ templateId: quotationTemplate })
      .expect(201);
    expect(first.body).toMatchObject({
      type: 'QUOTATION',
      source: 'GENERATED',
      templateVersion: 1,
      document: { version: 1 },
    });
    expect(first.body.document.fileName).toMatch(
      /^Báo giá HD-\d{4}-\d{3}\.docx$/,
    );
    const documentId = first.body.document.id;
    const stored = await ctx.prisma.document.findUniqueOrThrow({
      where: { id: documentId },
    });
    expect(stored).toMatchObject({
      customerId,
      contractId,
      category: 'CONTRACT',
    });
    const text = await docxText((await download(documentId, 1)).body);
    expect(text).toContain('Khách hàng: Công ty Hồ sơ — MST 0100000777');
    expect(text).toContain('Tổng thanh toán: 13.200.000 đồng');
    expect(text).toContain('Bằng chữ: Mười ba triệu hai trăm nghìn đồng');
    expect(text).toContain('1 Kế toán thuế 2026 12 1.000.000 12.000.000');

    const again = await as('director')
      .post(`/contracts/${contractId}/documents/generate`)
      .send({ templateId: quotationTemplate, documentId })
      .expect(201);
    expect(again.body.document).toMatchObject({ id: documentId, version: 2 });
    expect(
      await ctx.prisma.auditLog.count({
        where: { action: 'GENERATE_DOCUMENT', entityId: contractId },
      }),
    ).toBe(2);
  });

  it('chặn tạo hồ sơ khi thiếu quyền, sai trạng thái HĐ hoặc mẫu ngừng dùng', async () => {
    const generate = (who: keyof TestContext['users'], templateId: string) =>
      as(who)
        .post(`/contracts/${contractId}/documents/generate`)
        .send({ templateId });
    for (const who of ['staff', 'cashier', 'admin'] as const)
      await generate(who, quotationTemplate).expect(403);
    await ctx.prisma.user.update({
      where: { id: ctx.users.manager.id },
      data: { financialAccess: false },
    });
    await generate('manager', quotationTemplate).expect(403);
    await ctx.prisma.user.update({
      where: { id: ctx.users.manager.id },
      data: { financialAccess: null },
    });

    const request = await uploadTemplate(
      'director',
      await sampleTemplate('PAYMENT_REQUEST'),
      { type: 'PAYMENT_REQUEST', name: 'Đề nghị thanh toán' },
    ).expect(201);
    const res = await generate('director', request.body.id).expect(400);
    expect(res.body.message).toContain('đề nghị thanh toán');

    await as('director')
      .patch(`/document-templates/${quotationTemplate}`)
      .send({ isActive: false })
      .expect(200);
    await generate('director', quotationTemplate).expect(400);
    await as('director')
      .patch(`/document-templates/${quotationTemplate}`)
      .send({ isActive: true })
      .expect(200);
  });

  it('thay phiên bản mẫu: hồ sơ sau dùng phiên bản mới, phiên bản cũ vẫn tải được', async () => {
    const file = await buildDocx([
      { paragraph: 'BÁO GIÁ v2 {{contract.code}} {{contract.totalInWords}}' },
    ]);
    const updated = await as('director')
      .post(`/document-templates/${quotationTemplate}/versions`)
      .attach('file', file, 'bao-gia-v2.docx')
      .field('note', 'Đổi bố cục')
      .expect(201);
    expect(updated.body).toMatchObject({ version: 2 });
    const versions = await as('director')
      .get(`/document-templates/${quotationTemplate}/versions`)
      .expect(200);
    expect(versions.body.map((v: { version: number }) => v.version)).toEqual([
      2, 1,
    ]);
    await as('director')
      .get(`/document-templates/${quotationTemplate}/versions/1/download`)
      .expect(200);
    const created = await as('manager')
      .post(`/contracts/${contractId}/documents/generate`)
      .send({ templateId: quotationTemplate })
      .expect(201);
    expect(created.body.templateVersion).toBe(2);
    const text = await docxText(
      (await download(created.body.document.id, 1)).body,
    );
    expect(text).toContain('BÁO GIÁ v2');
  });

  it('tải bản scan đã ký (PDF) và xem trước; từ chối DOCX và người thiếu quyền', async () => {
    const signed = (
      who: keyof TestContext['users'],
      file: Buffer,
      name: string,
    ) =>
      as(who)
        .post(`/contracts/${contractId}/documents/signed`)
        .attach('file', file, name)
        .field('type', 'CONTRACT');
    for (const who of ['staff', 'cashier', 'admin'] as const)
      await signed(who, PDF, 'hop-dong-da-ky.pdf').expect(403);
    await signed('manager', await sampleTemplate('CONTRACT'), 'hd.docx').expect(
      400,
    );
    const res = await signed('manager', PDF, 'hop-dong-da-ky.pdf').expect(201);
    expect(res.body).toMatchObject({ type: 'CONTRACT', source: 'SIGNED' });
    await as('staff')
      .get(`/documents/${res.body.document.id}/versions/1/preview`)
      .expect(200)
      .expect('Content-Type', /application\/pdf/);
  });

  it('danh sách hồ sơ theo phạm vi; nhân viên ngoài phạm vi nhận 404', async () => {
    const list = await as('staff')
      .get(`/contracts/${contractId}/documents`)
      .expect(200);
    expect(
      list.body
        .map((d: { source: string; type: string }) => `${d.source}:${d.type}`)
        .sort(),
    ).toEqual([
      'GENERATED:QUOTATION',
      'GENERATED:QUOTATION',
      'SIGNED:CONTRACT',
    ]);
    await as('staff2').get(`/contracts/${contractId}/documents`).expect(404);
    await as('admin').get(`/contracts/${contractId}/documents`).expect(403);
  });
});
