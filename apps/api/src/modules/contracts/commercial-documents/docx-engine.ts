import { BadRequestException } from '@nestjs/common';
import { createReport, listCommands } from 'docx-templates';
import { FIELD_DELIMITERS, validateTemplateCommands } from './template-fields';

/**
 * Dấu chèn XML thô của docx-templates. Đặt bằng ký tự dùng riêng (Private Use) và dữ liệu trộn
 * đã lọc bỏ các ký tự này, nên nội dung người dùng nhập không chèn được XML vào file Word.
 */
export const LITERAL_XML_DELIMITER = '\uE000\uE001';

type RunJs = NonNullable<Parameters<typeof createReport>[0]['runJs']>;

/**
 * Thay cho việc chạy JavaScript của docx-templates: chỉ tra đường dẫn a.b.c trong dữ liệu.
 * Lệnh đã được kiểm tra theo danh sách trường trước khi trộn nên không có biểu thức nào khác.
 */
const resolvePath: RunJs = ({ sandbox }) => {
  const path = (typeof sandbox.__code__ === 'string' ? sandbox.__code__ : '')
    .trim()
    .split('.');
  let value: unknown = sandbox;
  for (const key of path) {
    value =
      value !== null &&
      typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, key)
        ? (value as Record<string, unknown>)[key]
        : undefined;
  }
  return { modifiedSandbox: sandbox, result: value };
};

/** Đọc và kiểm tra trường trộn của mẫu; trả về các trường dùng. Lỗi → 400. */
export async function readTemplateFields(template: Buffer): Promise<string[]> {
  let commands: { type: string; code: string }[];
  try {
    commands = await listCommands(
      template.buffer.slice(
        template.byteOffset,
        template.byteOffset + template.byteLength,
      ) as ArrayBuffer,
      FIELD_DELIMITERS,
    );
  } catch {
    throw new BadRequestException(
      'Không đọc được trường trộn trong mẫu Word; kiểm tra dấu {{ }} đóng mở đủ',
    );
  }
  return validateTemplateCommands(commands);
}

/** Trộn dữ liệu vào mẫu đã kiểm tra, trả về file .docx. */
export async function renderTemplate(
  template: Buffer,
  data: Record<string, unknown>,
): Promise<Buffer> {
  await readTemplateFields(template);
  try {
    const output = await createReport({
      template,
      data,
      cmdDelimiter: FIELD_DELIMITERS,
      literalXmlDelimiter: LITERAL_XML_DELIMITER,
      runJs: resolvePath,
      rejectNullish: true,
      processLineBreaks: true,
    });
    return Buffer.from(output);
  } catch {
    throw new BadRequestException(
      'Không trộn được dữ liệu vào mẫu; kiểm tra vòng lặp FOR/END-FOR trong mẫu',
    );
  }
}
