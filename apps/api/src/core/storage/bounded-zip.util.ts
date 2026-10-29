import { BadRequestException } from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';

export function readBoundedZip(
  buffer: Buffer,
  maxCompressed = 20 * 1024 * 1024,
  maxExpanded = 100 * 1024 * 1024,
) {
  if (buffer.length > maxCompressed || buffer.length < 22)
    throw new BadRequestException('File nén vượt giới hạn kích thước');
  let end = buffer.length - 22;
  while (
    end >= Math.max(0, buffer.length - 65557) &&
    buffer.readUInt32LE(end) !== 0x06054b50
  )
    end--;
  if (end < 0 || buffer.readUInt32LE(end) !== 0x06054b50)
    throw new BadRequestException('File Office không hợp lệ');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  let total = 0;
  const names = new Set<string>();
  const entries = new Map<string, Buffer>();
  if (
    !count ||
    count > 256 ||
    buffer.readUInt16LE(end + 4) ||
    buffer.readUInt16LE(end + 6)
  )
    throw new BadRequestException('Cấu trúc Office không được hỗ trợ');
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new BadRequestException('Danh mục Office không hợp lệ');
    const flags = buffer.readUInt16LE(offset + 8),
      method = buffer.readUInt16LE(offset + 10);
    const packed = buffer.readUInt32LE(offset + 20),
      size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString('utf8');
    const local = buffer.readUInt32LE(offset + 42);
    total += size;
    if (
      total > maxExpanded ||
      size > maxExpanded ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      names.has(name) ||
      /(^\/|\.\.|\\|vbaProject|externalLinks)/i.test(name)
    )
      throw new BadRequestException(
        'Office chứa nội dung không được phép hoặc quá lớn',
      );
    names.add(name);
    if (local + 30 > offset || buffer.readUInt32LE(local) !== 0x04034b50)
      throw new BadRequestException('Nội dung Office không hợp lệ');
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (start + packed > offset)
      throw new BadRequestException('Nội dung Office vượt giới hạn');
    const compressed = buffer.subarray(start, start + packed);
    const content =
      method === 0
        ? compressed
        : inflateRawSync(compressed, {
            maxOutputLength: Math.min(maxExpanded, size + 1),
          });
    if (content.length !== size)
      throw new BadRequestException('Kích thước Office không hợp lệ');
    entries.set(name, content);
    offset +=
      46 +
      nameLength +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
  }
  return entries;
}
