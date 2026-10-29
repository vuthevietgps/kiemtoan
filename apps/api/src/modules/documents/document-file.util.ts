import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';
import { readBoundedZip } from '../../core/storage/bounded-zip.util';
import type { UploadedFileInfo } from '../../core/storage/storage.service';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export function validateDocumentFile(file: UploadedFileInfo): UploadedFileInfo {
  const extension = extname(file.originalname).toLowerCase();
  if (
    !MIME[extension] ||
    [...file.originalname].some(
      (character) =>
        character.charCodeAt(0) < 32 || character === '/' || character === '\\',
    ) ||
    file.buffer.length > 20 * 1024 * 1024 ||
    !file.buffer.length
  )
    throw new BadRequestException(
      'Chỉ nhận PDF, PNG, JPEG, DOCX, XLSX, PPTX; tối đa 20 MB mỗi file',
    );
  const bytes = file.buffer;
  const correct =
    extension === '.pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : extension === '.png'
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : ['.jpg', '.jpeg'].includes(extension)
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : officeFile(bytes, extension);
  if (!correct)
    throw new BadRequestException(
      'Nội dung file không khớp định dạng cho phép',
    );
  return { ...file, mimetype: MIME[extension], size: bytes.length };
}

function officeFile(buffer: Buffer, extension: string) {
  try {
    const entries = readBoundedZip(buffer);
    const required: Record<string, string> = {
      '.docx': 'word/document.xml',
      '.xlsx': 'xl/workbook.xml',
      '.pptx': 'ppt/presentation.xml',
    };
    if (
      !entries.has('[Content_Types].xml') ||
      !entries.has(required[extension])
    )
      return false;
    if (
      /macroEnabled|vbaProject/i.test(
        entries.get('[Content_Types].xml')!.toString(),
      )
    )
      return false;
    return ![...entries.keys()].some((name) =>
      /\.bin$|\/embeddings\//i.test(name),
    );
  } catch {
    return false;
  }
}
