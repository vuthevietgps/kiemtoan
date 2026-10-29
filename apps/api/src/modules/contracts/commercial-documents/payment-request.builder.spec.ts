import { Prisma } from '@prisma/client';
import JSZip from 'jszip';
import { renderTemplate, readTemplateFields } from './docx-engine';
import {
  paymentTemplateData,
  previewPaymentRequest,
  selectInstallments,
} from './payment-request.builder';
import { buildDocx, sampleTemplate } from './sample-template.util';
import {
  buildTemplateData,
  type CompanyProfile,
  type TemplateContract,
} from './template-data.builder';

const D = (v: string) => new Prisma.Decimal(v);
const company: CompanyProfile = {
  name: 'Công ty Kế toán A&B',
  taxCode: '0101234567',
  address: 'Hà Nội',
  phone: '024 000',
  representative: 'Nguyễn Văn A',
  representativeTitle: 'Giám đốc',
  bankAccount: '19036789012',
  bankName: 'Techcombank',
  bankBin: '970407',
};
const contract = {
  id: 'c1',
  code: 'HD-2026-007',
  status: 'IN_PROGRESS',
  customerId: 'k1',
  signedDate: null,
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: null,
  vatRate: D('10'),
  subtotal: D('3000000'),
  vatAmount: D('300000'),
  total: D('3300000'),
  note: null,
  owner: null,
  customer: {
    name: 'Công ty B',
    taxCode: '0100000001',
    address: null,
    legalRep: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
  },
  services: [],
  installments: [
    // Đợt 1 đã thu đủ, đợt 2 thu 300.000, đợt 3 chưa thu.
    {
      id: 'i1',
      name: 'Tạm ứng',
      amount: D('1100000'),
      dueDate: new Date('2026-02-01T00:00:00Z'),
      allocations: [{ amount: D('1100000') }],
    },
    {
      id: 'i2',
      name: 'Đợt 2',
      amount: D('1100000'),
      dueDate: new Date('2026-05-01T00:00:00Z'),
      allocations: [{ amount: D('300000') }],
    },
    {
      id: 'i3',
      name: 'Đợt 3',
      amount: D('1100000'),
      dueDate: new Date('2026-04-01T00:00:00Z'),
      allocations: [],
    },
  ],
} as unknown as TemplateContract;

describe('đề nghị thanh toán (07-D3, J9)', () => {
  it('chỉ đợt còn nợ; số còn thiếu sau phân bổ đã duyệt; đợt đã thu đủ hoặc của HĐ khác → 400', () => {
    expect(
      selectInstallments(contract, null).map((i) => [
        i.id,
        i.remaining.toString(),
      ]),
    ).toEqual([
      ['i2', '800000'],
      ['i3', '1100000'],
    ]);
    expect(() => selectInstallments(contract, ['i1'])).toThrow(/còn nợ/);
    expect(() => selectInstallments(contract, ['other'])).toThrow(/còn nợ/);
  });

  it('xem trước: tổng các đợt chọn, bằng chữ, nội dung CK không dấu có mã HĐ, chuỗi VietQR có số tiền', () => {
    const preview = previewPaymentRequest(contract, company, ['i2', 'i3']);
    expect(preview.amount.toString()).toBe('1900000');
    expect(preview.amountInWords).toMatch(/^Một triệu chín trăm nghìn đồng/);
    expect(preview.transferContent).toBe('TT HD-2026-007');
    expect(preview.qrPayload).toContain('0006970407011119036789012');
    expect(preview.qrPayload).toContain('54071900000');
    expect(preview.qrPayload).toContain('0814TT HD-2026-007');
    expect(
      previewPaymentRequest(contract, { ...company, bankBin: '' }, ['i2'])
        .qrPayload,
    ).toBeNull();
  });

  it('mẫu ví dụ "Đề nghị thanh toán" trộn số tiền, hạn sớm nhất và chèn ảnh QR vào file Word', async () => {
    const template = await sampleTemplate('PAYMENT_REQUEST');
    expect(await readTemplateFields(template)).toEqual(
      expect.arrayContaining(['payment.amount', 'payment.qr']),
    );
    const payment = await paymentTemplateData(
      previewPaymentRequest(contract, company, ['i2', 'i3']),
    );
    const output = await renderTemplate(
      template,
      buildTemplateData(
        contract,
        company,
        new Date('2026-10-29T03:00:00Z'),
        payment,
      ),
    );
    const zip = await JSZip.loadAsync(output);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Đợt 2, Đợt 3');
    expect(xml).toContain('1.900.000');
    expect(xml).toContain('01/04/2026');
    expect(xml).toContain('TT HD-2026-007');
    expect(xml).not.toContain('{{');
    const images = Object.keys(zip.files).filter(
      (n) => n.startsWith('word/media/') && n.endsWith('.png'),
    );
    expect(images).toHaveLength(1);
    const png = await zip.file(images[0])!.async('nodebuffer');
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });

  it('mẫu chỉ được dùng IMAGE cho payment.qr', async () => {
    await expect(
      readTemplateFields(
        await buildDocx([{ paragraph: '{{IMAGE company.name}}' }]),
      ),
    ).rejects.toThrow(/không hợp lệ/);
  });
});
