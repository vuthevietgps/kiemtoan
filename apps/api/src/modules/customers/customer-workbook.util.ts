import { BadRequestException } from '@nestjs/common';
import { readBoundedZip } from '../../core/storage/bounded-zip.util';
import { Workbook, ValueType } from 'exceljs';

export const CUSTOMER_COLUMNS = [
  'Tên khách hàng',
  'Mã số thuế',
  'Địa chỉ',
  'Người đại diện',
  'Loại hình',
  'Kỳ thuế',
  'Trạng thái',
  'Người liên hệ',
  'Điện thoại',
  'Email',
  'Email người phụ trách',
  'Ghi chú',
  'Tháng kết thúc năm tài chính',
  'Phương pháp thuế GTGT',
  'Kỳ khai TNCN',
  'Chế độ kế toán',
  'Cơ quan thuế quản lý',
] as const;
const LAST_COLUMN = String.fromCharCode(64 + CUSTOMER_COLUMNS.length);
const MAX_EXPANDED = 20 * 1024 * 1024;

/** Validate all ZIP payloads with a bounded inflater before a workbook parser allocates cells. */
export function validateWorkbookZip(buffer: Buffer) {
  const entries = readBoundedZip(buffer, 5 * 1024 * 1024, MAX_EXPANDED);
  if (!entries.has('xl/workbook.xml'))
    throw new BadRequestException('Vui lòng chọn file XLSX');
  for (const [name, content] of entries) {
    if (name.endsWith('.xml') || name.endsWith('.rels'))
      checkWorkbookXml(name, content.toString('utf8'));
  }
}

function checkWorkbookXml(name: string, xml: string) {
  if (
    /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External["']|macroEnabled|<(?:(?:\w+):)?f(?:\s|>)/i.test(
      xml,
    )
  )
    throw new BadRequestException(
      'Không nhận công thức, macro hoặc liên kết ngoài',
    );
  if (!name.startsWith('xl/worksheets/')) return;
  for (const row of xml.matchAll(/<row\b[^>]*\br\s*=\s*["'](\d+)["']/g)) {
    if (+row[1] > 2001)
      throw new BadRequestException('Mỗi file tối đa 2.000 dòng khách hàng');
  }
  for (const cell of xml.matchAll(
    /<c\b[^>]*\br\s*=\s*["']([A-Z]+)(\d+)["']/g,
  )) {
    if (cell[1].length > 1 || cell[1] > LAST_COLUMN || +cell[2] > 2001)
      throw new BadRequestException('XLSX vượt số dòng hoặc cột của mẫu');
  }
}

export async function readCustomerWorkbook(
  buffer: Buffer,
): Promise<string[][]> {
  try {
    validateWorkbookZip(buffer);
    const workbook = new Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    const sheet = workbook.getWorksheet('Khach hang') ?? workbook.worksheets[0];
    if (
      !sheet ||
      sheet.rowCount > 2001 ||
      sheet.columnCount > CUSTOMER_COLUMNS.length
    )
      throw new BadRequestException('XLSX vượt giới hạn mẫu');
    const rows: string[][] = [];
    for (let index = 1; index <= sheet.rowCount; index++) {
      const row = sheet.getRow(index);
      const values = CUSTOMER_COLUMNS.map((_, column) => {
        const cell = row.getCell(column + 1);
        if (
          cell.type === ValueType.Formula ||
          cell.type === ValueType.Hyperlink
        )
          throw new BadRequestException('Không nhận công thức hoặc liên kết');
        if ((column === 1 || column === 8) && typeof cell.value === 'number')
          throw new BadRequestException(
            `Dòng ${index}: MST và điện thoại phải là ô văn bản để giữ số 0 đầu`,
          );
        const text = cell.text.trim();
        if (text.length > 2000)
          throw new BadRequestException(`Dòng ${index}: ô dữ liệu quá dài`);
        return text;
      });
      rows.push(values);
    }
    if (rows[0]?.join('|') !== CUSTOMER_COLUMNS.join('|'))
      throw new BadRequestException(
        'Cột XLSX không khớp mẫu. Vui lòng tải mẫu mới',
      );
    return rows.slice(1);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(
      'Không đọc được file XLSX hoặc nội dung vượt giới hạn',
    );
  }
}

export async function writeCustomerWorkbook(
  rows: string[][],
  instructions = false,
) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Khach hang');
  sheet.addRow([...CUSTOMER_COLUMNS]);
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((column, index) => {
    column.width = index === 0 ? 35 : 24;
    column.numFmt = '@';
  });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (instructions) {
    const guide = workbook.addWorksheet('Huong dan');
    [
      'Nhập dữ liệu vào sheet Khach hang, giữ nguyên tên cột.',
      'Mã số thuế và điện thoại phải là văn bản, giữ số 0 đầu.',
      'Kỳ thuế: MONTHLY hoặc QUARTERLY; trạng thái: PROSPECT, ACTIVE, PAUSED, STOPPED.',
      'Tháng kết thúc năm tài chính: 1–12 (trống = 12). Phương pháp thuế GTGT: DEDUCTION, DIRECT, NONE; kỳ khai TNCN: MONTHLY, QUARTERLY, NONE; chế độ kế toán: TT200, TT133, OTHER.',
      'Email người phụ trách để trống thì giao người nhập; phải thuộc phạm vi quản lý.',
      'Tối đa 2.000 dòng / 5 MB, không công thức, macro, liên kết ngoài.',
      'Xem trước, kiểm tra lỗi và xác nhận nhập các dòng hợp lệ. Không cập nhật khách hàng cũ.',
    ].forEach((text) => guide.addRow([text]));
    guide.getColumn(1).width = 110;
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
