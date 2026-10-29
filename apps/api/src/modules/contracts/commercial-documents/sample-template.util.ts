import { DocumentTemplateType } from '@prisma/client';
import JSZip from 'jszip';

/** Khối nội dung của file mẫu ví dụ: đoạn văn hoặc bảng lặp theo danh sách. */
export type SampleBlock =
  | { paragraph: string; bold?: boolean; center?: boolean }
  | { headers: string[]; row: string[]; list: 'services' | 'installments' };

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function paragraph(text: string, bold = false, center = false): string {
  const props = center ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : '';
  const run = bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p>${props}<w:r>${run}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

const cell = (text: string, bold = false) =>
  `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraph(text, bold)}</w:tc>`;

/** Bảng có hàng tiêu đề và một hàng lặp: FOR ở ô đầu, END-FOR ở ô cuối. */
function table(headers: string[], row: string[], list: string): string {
  const cells = row.map((field, index) => {
    const value = `{{$item.${field}}}`;
    if (index === 0) return cell(`{{FOR item IN ${list}}}${value}`);
    if (index === row.length - 1) return cell(`${value}{{END-FOR item}}`);
    return cell(value);
  });
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(
      (side) =>
        `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`,
    )
    .join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr><w:tr>${headers.map((h) => cell(h, true)).join('')}</w:tr><w:tr>${cells.join('')}</w:tr></w:tbl>`;
}

/** Dựng file .docx tối giản từ các khối nội dung (dùng cho mẫu ví dụ và test). */
export async function buildDocx(blocks: SampleBlock[]): Promise<Buffer> {
  const body = blocks
    .map((block) =>
      'paragraph' in block
        ? paragraph(block.paragraph, block.bold, block.center)
        : table(block.headers, block.row, block.list),
    )
    .join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('word/document.xml', document);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const TITLES: Record<DocumentTemplateType, string> = {
  QUOTATION: 'BÁO GIÁ DỊCH VỤ',
  CONTRACT: 'HỢP ĐỒNG DỊCH VỤ',
  APPENDIX: 'PHỤ LỤC HỢP ĐỒNG',
  ACCEPTANCE: 'BIÊN BẢN NGHIỆM THU',
  LIQUIDATION: 'BIÊN BẢN THANH LÝ HỢP ĐỒNG',
  PAYMENT_REQUEST: 'ĐỀ NGHỊ THANH TOÁN',
};

const SERVICES_TABLE: SampleBlock = {
  list: 'services',
  headers: ['STT', 'Dịch vụ', 'Kỳ', 'SL', 'Đơn giá', 'Thành tiền'],
  row: ['index', 'name', 'period', 'quantity', 'unitPrice', 'amount'],
};
const INSTALLMENTS_TABLE: SampleBlock = {
  list: 'installments',
  headers: ['STT', 'Đợt', 'Hạn thanh toán', 'Số tiền'],
  row: ['index', 'name', 'dueDate', 'amount'],
};

/**
 * Mẫu ví dụ cho từng loại hồ sơ, ghi rõ là mẫu giả: chưa có mẫu Word thật (QD07).
 * Giám đốc tải về để xem cách đặt trường trộn rồi thay bằng mẫu của công ty.
 */
export function sampleTemplate(type: DocumentTemplateType): Promise<Buffer> {
  const withInstallments =
    type === 'CONTRACT' || type === 'PAYMENT_REQUEST' || type === 'APPENDIX';
  return buildDocx([
    { paragraph: '{{company.name}}', bold: true },
    { paragraph: 'MST: {{company.taxCode}} — {{company.address}}' },
    { paragraph: TITLES[type], bold: true, center: true },
    {
      paragraph: '(Mẫu ví dụ do hệ thống tạo, chưa phải mẫu chính thức)',
      center: true,
    },
    { paragraph: 'Số hợp đồng: {{contract.code}}' },
    {
      paragraph: 'Ngày {{today.day}} tháng {{today.month}} năm {{today.year}}',
    },
    { paragraph: 'Khách hàng: {{customer.name}} — MST {{customer.taxCode}}' },
    { paragraph: 'Địa chỉ: {{customer.address}}' },
    { paragraph: 'Đại diện: {{customer.legalRep}}' },
    SERVICES_TABLE,
    { paragraph: 'Cộng tiền dịch vụ: {{contract.subtotal}} đồng' },
    {
      paragraph: 'Thuế GTGT {{contract.vatRate}}%: {{contract.vatAmount}} đồng',
    },
    { paragraph: 'Tổng thanh toán: {{contract.total}} đồng', bold: true },
    { paragraph: 'Bằng chữ: {{contract.totalInWords}}' },
    ...(withInstallments ? [INSTALLMENTS_TABLE] : []),
    {
      paragraph:
        'Tài khoản nhận: {{company.bankAccount}} tại {{company.bankName}}',
    },
    {
      paragraph:
        'ĐẠI DIỆN BÊN A                    ĐẠI DIỆN BÊN B ({{company.representative}})',
      bold: true,
    },
  ]);
}
