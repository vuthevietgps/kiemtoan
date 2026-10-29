import { DocumentTemplateType, PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readTemplateFields } from '../../src/modules/contracts/commercial-documents/docx-engine';
import { sampleTemplate } from '../../src/modules/contracts/commercial-documents/sample-template.util';
import { TEMPLATE_TYPE_LABELS } from '../../src/modules/contracts/commercial-documents/commercial-documents.constants';

/**
 * Mẫu hồ sơ ví dụ cho môi trường dev (04-C). Đây là mẫu giả để thử cơ chế; mẫu Word thật
 * của công ty chưa có (QD07). Chạy lại không tạo trùng.
 */
export async function seedTemplates(
  prisma: PrismaClient,
  directorId: string,
): Promise<void> {
  const root = resolve(process.env.UPLOAD_DIR ?? 'uploads');
  await mkdir(join(root, 'seed'), { recursive: true });
  for (const type of Object.values(DocumentTemplateType)) {
    const name = `${TEMPLATE_TYPE_LABELS[type]} (mẫu ví dụ)`;
    if (await prisma.documentTemplate.findFirst({ where: { type, name } }))
      continue;
    const buffer = await sampleTemplate(type);
    const storedName = `seed/template-${type.toLowerCase()}.docx`;
    await writeFile(join(root, storedName), buffer);
    const fields = await readTemplateFields(buffer);
    const file = {
      fileName: `${name}.docx`,
      storedName,
      size: buffer.length,
      fields,
    };
    await prisma.documentTemplate.create({
      data: {
        type,
        name,
        description: 'Mẫu giả do hệ thống tạo, thay bằng mẫu Word thật (QD07)',
        ...file,
        createdById: directorId,
        versions: { create: { ...file, version: 1, uploadedById: directorId } },
      },
    });
  }
}
