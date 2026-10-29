import { BadRequestException } from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import JSZip from 'jszip';
import { readTemplateFields, renderTemplate } from './docx-engine';
import { buildDocx, sampleTemplate } from './sample-template.util';
import {
  buildTemplateData,
  CompanyProfile,
  TemplateContract,
} from './template-data.builder';
import { validateTemplateCommands } from './template-fields';

const D = (v: string) => new Prisma.Decimal(v);
const company: CompanyProfile = {
  name: 'Công ty Kế toán A&B',
  taxCode: '0101234567',
  address: 'Hà Nội',
  phone: '024 000',
  representative: 'Nguyễn Văn A',
  representativeTitle: 'Giám đốc',
  bankAccount: '19001234',
  bankName: 'Techcombank',
};
const contract: TemplateContract = {
  id: 'c1',
  code: 'HD-2026-001',
  status: ContractStatus.DRAFT,
  customerId: 'k1',
  signedDate: null,
  startDate: new Date('2026-11-02T00:00:00Z'),
  endDate: new Date('2027-10-31T00:00:00Z'),
  vatRate: D('10'),
  subtotal: D('12000000'),
  vatAmount: D('1200000'),
  total: D('13200000'),
  note: 'Dòng 1\nDòng 2',
  owner: { fullName: 'Trần B' },
  customer: {
    name: 'Công ty <X> ||<w:p/>||',
    taxCode: '0309999999',
    address: null,
    legalRep: 'Lê C',
    contactName: null,
    contactPhone: null,
    contactEmail: null,
  },
  services: [
    {
      description: null,
      period: '2026',
      quantity: 12,
      unitPrice: D('1000000'),
      amount: D('12000000'),
      serviceType: { code: 'KTT', name: 'Kế toán thuế' },
    },
  ],
  installments: [
    {
      name: 'Tạm ứng',
      amount: D('6600000'),
      dueDate: new Date('2026-11-15T00:00:00Z'),
    },
    {
      name: 'Đợt 2',
      amount: D('6600000'),
      dueDate: new Date('2027-05-15T00:00:00Z'),
    },
  ],
};

async function textOf(docx: Buffer) {
  const zip = await JSZip.loadAsync(docx);
  const xml = await zip.file('word/document.xml')!.async('string');
  return { xml, text: xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
}

describe('commercial document templates', () => {
  const now = new Date('2026-10-16T18:30:00Z'); // 17/10/2026 giờ Việt Nam

  it('merges published fields with money in figures and words', async () => {
    const data = buildTemplateData(contract, company, now);
    const { text } = await textOf(
      await renderTemplate(await sampleTemplate('CONTRACT'), data),
    );
    expect(text).toContain('Số hợp đồng: HD-2026-001');
    expect(text).toContain('Ngày 17 tháng 10 năm 2026');
    expect(text).toContain('Tổng thanh toán: 13.200.000 đồng');
    expect(text).toContain('Bằng chữ: Mười ba triệu hai trăm nghìn đồng');
    expect(text).toContain('1 Kế toán thuế 2026 12 1.000.000 12.000.000');
    expect(text).toContain('1 Tạm ứng 15/11/2026 6.600.000');
    expect(text).toContain('2 Đợt 2 15/05/2027 6.600.000');
    expect(text).toContain('Techcombank');
  });

  it('escapes user text so it cannot inject Word XML', async () => {
    const data = buildTemplateData(contract, company, now);
    const { xml } = await textOf(
      await renderTemplate(await sampleTemplate('QUOTATION'), data),
    );
    expect(xml).toContain('Công ty &lt;X&gt; ||&lt;w:p/&gt;||');
    expect(xml).not.toContain('<w:p/>');
  });

  it('rejects templates with fields outside the published list', async () => {
    for (const command of [
      '{{customer.password}}',
      '{{EXEC process.exit(1)}}',
      '{{IF contract.total}}x{{END-IF}}',
      '{{constructor.constructor}}',
      '{{FOR x IN users}}{{END-FOR x}}',
      '{{FOR x IN services}}{{$x.secret}}{{END-FOR x}}',
      '{{FOR x IN services}}',
    ]) {
      const template = await buildDocx([{ paragraph: command }]);
      await expect(readTemplateFields(template)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it('lists the fields a template uses, including loop columns', async () => {
    const template = await buildDocx([
      { paragraph: '{{= customer.name}} {{INS contract.totalInWords}}' },
      {
        list: 'installments',
        headers: ['Đợt', 'Bằng chữ'],
        row: ['name', 'amountInWords'],
      },
    ]);
    await expect(readTemplateFields(template)).resolves.toEqual([
      'contract.totalInWords',
      'customer.name',
      'installments',
      'installments.amountInWords',
      'installments.name',
    ]);
  });

  it('requires END-FOR to close the innermost loop', () => {
    expect(() =>
      validateTemplateCommands([
        { type: 'FOR', code: 'a IN services' },
        { type: 'FOR', code: 'b IN installments' },
        { type: 'END-FOR', code: 'a' },
        { type: 'END-FOR', code: 'b' },
      ]),
    ).toThrow(BadRequestException);
  });
});
