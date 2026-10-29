import { Prisma } from '@prisma/client';

export type CsvCell = string | number | Prisma.Decimal | null | undefined;

/** Byte order mark để Excel nhận đúng UTF-8. */
const BOM = String.fromCharCode(0xfeff);

function escapeCell(value: CsvCell): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV UTF-8 có BOM (Excel mở đúng tiếng Việt), dòng kết thúc CRLF. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(','));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
