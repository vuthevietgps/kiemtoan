import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentTemplateType, Prisma } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  StorageService,
  UploadedFileInfo,
} from '../../../core/storage/storage.service';
import { validateDocumentFile } from '../../documents/document-file.util';
import {
  CreateTemplateDto,
  TemplateQueryDto,
  UpdateTemplateDto,
} from '../dto/commercial-document.dto';
import { readTemplateFields } from './docx-engine';
import { sampleTemplate } from './sample-template.util';
import {
  FIELD_DELIMITERS,
  TEMPLATE_FIELDS,
  TEMPLATE_LISTS,
} from './template-fields';
import { TEMPLATE_TYPE_LABELS } from './commercial-documents.constants';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const TEMPLATE_SELECT = {
  id: true,
  type: true,
  name: true,
  description: true,
  isActive: true,
  version: true,
  fileName: true,
  size: true,
  fields: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentTemplateSelect;

/**
 * Mẫu Word hồ sơ thương mại (đặc tả 04-C): tải lên, thay phiên bản, ngừng dùng.
 * Mẫu chỉ được nhận khi mọi trường trộn thuộc danh sách công bố.
 */
@Injectable()
export class DocumentTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  list(query: TemplateQueryDto) {
    return this.prisma.documentTemplate.findMany({
      where: { deletedAt: null, type: query.type, isActive: query.active },
      select: TEMPLATE_SELECT,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  fields() {
    return {
      delimiters: FIELD_DELIMITERS,
      fields: TEMPLATE_FIELDS,
      lists: TEMPLATE_LISTS,
    };
  }

  async sample(type: DocumentTemplateType) {
    return {
      buffer: await sampleTemplate(type),
      fileName: `Mau vi du - ${TEMPLATE_TYPE_LABELS[type]}.docx`,
    };
  }

  async create(
    user: AuthUser,
    file: UploadedFileInfo | undefined,
    dto: CreateTemplateDto,
  ) {
    const { info, fields } = await this.checkFile(file);
    const stored = await this.storage.save(info);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const template = await tx.documentTemplate.create({
          data: {
            ...dto,
            fileName: stored.fileName,
            storedName: stored.storedName,
            size: stored.size,
            fields,
            createdById: user.id,
            updatedById: user.id,
            versions: {
              create: {
                version: 1,
                fileName: stored.fileName,
                storedName: stored.storedName,
                size: stored.size,
                fields,
                uploadedById: user.id,
              },
            },
          },
          select: TEMPLATE_SELECT,
        });
        await this.audit(tx, user, 'TEMPLATE_UPLOAD', template.id, {
          type: template.type,
          version: 1,
          fields,
        });
        return template;
      });
    } catch (error) {
      await this.storage.remove(stored.storedName);
      throw error;
    }
  }

  /** Thay file mẫu: phiên bản mới, phiên bản cũ giữ lại để tra cứu. Khoá dòng tránh trùng số. */
  async addVersion(
    user: AuthUser,
    id: string,
    file: UploadedFileInfo | undefined,
    note?: string,
  ) {
    await this.findActive(id);
    const { info, fields } = await this.checkFile(file);
    const stored = await this.storage.save(info);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM document_templates WHERE id = ${id}::uuid FOR UPDATE`;
        const current = await this.findActive(id, tx);
        const version = current.version + 1;
        await tx.documentTemplateVersion.create({
          data: {
            templateId: id,
            version,
            fileName: stored.fileName,
            storedName: stored.storedName,
            size: stored.size,
            fields,
            note,
            uploadedById: user.id,
          },
        });
        const template = await tx.documentTemplate.update({
          where: { id },
          data: {
            version,
            fileName: stored.fileName,
            storedName: stored.storedName,
            size: stored.size,
            fields,
            updatedById: user.id,
          },
          select: TEMPLATE_SELECT,
        });
        await this.audit(tx, user, 'TEMPLATE_VERSION', id, { version, fields });
        return template;
      });
    } catch (error) {
      await this.storage.remove(stored.storedName);
      throw error;
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateTemplateDto) {
    const before = await this.findActive(id);
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.documentTemplate.update({
        where: { id },
        data: { ...dto, updatedById: user.id },
        select: TEMPLATE_SELECT,
      });
      const changed = (Object.keys(dto) as (keyof UpdateTemplateDto)[]).filter(
        (key) => dto[key] !== undefined && dto[key] !== before[key],
      );
      if (changed.length)
        await this.audit(tx, user, 'TEMPLATE_UPDATE', id, {
          before: Object.fromEntries(changed.map((k) => [k, before[k]])),
          after: Object.fromEntries(changed.map((k) => [k, template[k]])),
        });
      return template;
    });
  }

  async versions(id: string) {
    await this.findActive(id);
    return this.prisma.documentTemplateVersion.findMany({
      where: { templateId: id },
      select: {
        id: true,
        version: true,
        fileName: true,
        size: true,
        fields: true,
        note: true,
        createdAt: true,
      },
      orderBy: { version: 'desc' },
    });
  }

  async fileOf(id: string, version?: number) {
    const template = await this.findActive(id);
    const file =
      version === undefined
        ? template
        : await this.prisma.documentTemplateVersion.findUnique({
            where: { templateId_version: { templateId: id, version } },
          });
    if (!file) throw new NotFoundException('Không tìm thấy phiên bản mẫu');
    return {
      path: this.storage.pathOf(file.storedName),
      fileName: file.fileName,
    };
  }

  /** Mẫu đang dùng kèm nội dung file, để sinh hồ sơ. */
  async loadForGeneration(id: string) {
    const template = await this.findActive(id);
    if (!template.isActive)
      throw new BadRequestException('Mẫu hồ sơ đã ngừng dùng');
    const buffer = await readFile(this.storage.pathOf(template.storedName));
    return { template, buffer };
  }

  /**
   * 07-D3: mẫu chọn (`id`), hoặc mẫu đang dùng mới nhất của loại; chưa có mẫu nào thì mẫu ví dụ của
   * hệ thống (`template` null — hồ sơ không gắn mẫu).
   */
  async loadOrSample(type: DocumentTemplateType, id?: string) {
    const chosen = id
      ? await this.findActive(id)
      : await this.prisma.documentTemplate.findFirst({
          where: { type, isActive: true, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
        });
    if (chosen && chosen.type !== type)
      throw new BadRequestException('Mẫu đã chọn không đúng loại hồ sơ');
    if (!chosen) return { template: null, buffer: await sampleTemplate(type) };
    return this.loadForGeneration(chosen.id);
  }

  private async findActive(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const template = await tx.documentTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!template) throw new NotFoundException('Không tìm thấy mẫu hồ sơ');
    return template;
  }

  /** Kiểm tra như kho hồ sơ 02 (định dạng, không macro, dung lượng), chỉ nhận .docx. */
  private async checkFile(file: UploadedFileInfo | undefined) {
    if (!file) throw new BadRequestException('Vui lòng chọn file mẫu .docx');
    const info = validateDocumentFile(file);
    if (info.mimetype !== DOCX_MIME)
      throw new BadRequestException('Mẫu hồ sơ phải là file Word .docx');
    return { info, fields: await readTemplateFields(info.buffer) };
  }

  private async audit(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    action: string,
    entityId: string,
    detail: Prisma.InputJsonValue,
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action,
        entity: 'document-templates',
        entityId,
        detail,
      },
    });
  }
}
