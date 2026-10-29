/** Minimal OpenXML workbook: inline strings prevent formula execution in exported audit data. */
const xml = (value: string): string =>
  [...value]
    .filter(
      (character) =>
        character >= ' ' ||
        character === '\t' ||
        character === '\n' ||
        character === '\r',
    )
    .join('')
    .slice(0, 32767)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files: Record<string, string>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const filename = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(filename.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, filename);
    offset += header.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  const count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
/** Ô chuỗi ghi dạng inline string (không chạy công thức); ô số (vd. tiền) ghi dạng số để tính tổng được. */
function cellXml(cell: string | number, ref: string): string {
  if (typeof cell === 'number' && Number.isFinite(cell))
    return `<c r="${ref}"><v>${cell}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(String(cell))}</t></is></c>`;
}
export function xlsxWorkbook(
  rows: (string | number)[][],
  sheetName = 'Nhat ky',
): Buffer {
  const sheet = rows
    .map(
      (row, index) =>
        `<row r="${index + 1}">${row.map((cell, column) => cellXml(cell, `${String.fromCharCode(65 + column)}${index + 1}`)).join('')}</row>`,
    )
    .join('');
  const namespace = 'http://schemas.openxmlformats.org';
  return zip({
    '[Content_Types].xml': `<Types xmlns="${namespace}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${namespace}/package/2006/relationships"><Relationship Id="rId1" Type="${namespace}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${namespace}/spreadsheetml/2006/main" xmlns:r="${namespace}/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${namespace}/package/2006/relationships"><Relationship Id="rId1" Type="${namespace}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${namespace}/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`,
  });
}
