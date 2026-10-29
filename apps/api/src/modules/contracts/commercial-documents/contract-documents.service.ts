import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ContractDocumentSource,
  DocumentCategory,
  DocumentTemplateType,
  Prisma,
} from '@prisma/client';
import { hasPermission } from '../../../core/access-control/permissions';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import type { UploadedFileInfo } from '../../../core/storage/storage.service';
import { validateDocumentFile } from '../../documents/document-file.util';
import { DocumentsService } from '../../documents/documents.service';
import { scopedContract } from '../contracts-query.service';
import {
  GenerateDocumentDto,
  UploadSignedDto,
} from '../dto/commercial-document.dto';
import {
  GENERATABLE_STATUSES,
  SIGNED_MIME_TYPES,
  TEMPLATE_TYPE_LABELS,
} from './commercial-documents.constants';
import { DocumentTemplatesService } from './document-templates.service';
import { renderTemplate } from './docx-engine';
import {
  buildTemplateData,
  companyProfile,
  TEMPLATE_CONTRACT_SELECT,
} from './template-data.builder';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const LIST_SELECT = {
  id: true,
  type: true,
  source: true,
  templateVersion: true,
  createdAt: true,
  updatedAt: true,
  template: { select: { id: true, name: true } },
  document: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      version: true,
      note: true,
      createdAt: true,
      uploadedBy: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.ContractDocumentSelect;

/** multer đọc tên file dạng latin1 và StorageService đổi lại sang UTF-8; tên tự sinh làm ngược lại. */
const asUploadName = (name: string) =>
  Buffer.from(name, 'utf8').toString('latin1');

/**
 * Hồ sơ thương mại của HĐ (đặc tả 04-C): sinh DOCX từ mẫu và bản scan đã ký, lưu vào kho hồ sơ
 * của khách hàng (02) ở nhóm Hợp đồng, gắn HĐ và có phiên bản.
 */
@Injectable()
export class ContractDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly documents: DocumentsService,
    private readonly templates: DocumentTemplatesService,
  ) {}

  async list(user: AuthUser, contractId: string) {
    await this.findContract(user, contractId);
    return this.prisma.contractDocument.findMany({
      where: { contractId, document: { deletedAt: null } },
      select: LIST_SELECT,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  /** Hồ sơ chứa số tiền nên cần thêm quyền xem tài chính và quyền tải hồ sơ. */
  async generate(user: AuthUser, contractId: string, dto: GenerateDocumentDto) {
    if (!hasPermission(user, 'finance', 'view'))
      throw new ForbiddenException(
        'Hồ sơ thương mại có số tiền; bạn cần quyền xem tài chính để tạo',
      );
    this.requireDocumentUpload(user);
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id: contractId }),
      select: TEMPLATE_CONTRACT_SELECT,
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    const { template, buffer } = await this.templates.loadForGeneration(
      dto.templateId,
    );
    if (!GENERATABLE_STATUSES[template.type].includes(contract.status))
      throw new BadRequestException(
        `Chưa tạo được ${TEMPLATE_TYPE_LABELS[template.type].toLowerCase()} ở trạng thái hợp đồng hiện tại`,
      );
    const existing = dto.documentId
      ? await this.findLinked(contractId, dto.documentId, 'GENERATED')
      : null;
    if (existing && existing.type !== template.type)
      throw new BadRequestException('Mẫu khác loại với hồ sơ đã chọn');
    const output = await renderTemplate(
      buffer,
      buildTemplateData(contract, companyProfile(this.config), new Date()),
    );
    const file: UploadedFileInfo = {
      originalname: asUploadName(
        `${TEMPLATE_TYPE_LABELS[template.type]} ${contract.code}.docx`,
      ),
      mimetype: DOCX_MIME,
      size: output.length,
      buffer: output,
    };
    const link = { templateId: template.id, templateVersion: template.version };
    const result = await this.store(user, contract, file, {
      type: template.type,
      source: 'GENERATED',
      existing,
      link,
      note: dto.note,
    });
    await this.audit(user, contractId, 'GENERATE_DOCUMENT', {
      type: template.type,
      templateId: template.id,
      templateVersion: template.version,
      documentId: result.document.id,
      version: result.document.version,
    });
    return result;
  }

  async uploadSigned(
    user: AuthUser,
    contractId: string,
    file: UploadedFileInfo | undefined,
    dto: UploadSignedDto,
  ) {
    this.requireDocumentUpload(user);
    if (!file) throw new BadRequestException('Vui lòng chọn bản scan đã ký');
    if (!SIGNED_MIME_TYPES.includes(validateDocumentFile(file).mimetype))
      throw new BadRequestException(
        'Bản scan đã ký phải là PDF, PNG hoặc JPEG',
      );
    const contract = await this.findContract(user, contractId);
    const existing = dto.documentId
      ? await this.findLinked(contractId, dto.documentId, 'SIGNED')
      : null;
    if (existing && existing.type !== dto.type)
      throw new BadRequestException('Loại hồ sơ khác với bản đã ký đã chọn');
    const result = await this.store(user, contract, file, {
      type: dto.type,
      source: 'SIGNED',
      existing,
      link: {},
      note: dto.note,
    });
    await this.audit(user, contractId, 'UPLOAD_SIGNED_DOCUMENT', {
      type: dto.type,
      documentId: result.document.id,
      version: result.document.version,
    });
    return result;
  }

  /** Lưu file vào kho hồ sơ: phiên bản mới của hồ sơ đã có, hoặc hồ sơ mới gắn với HĐ. */
  private async store(
    user: AuthUser,
    contract: { id: string; customerId: string },
    file: UploadedFileInfo,
    options: {
      type: DocumentTemplateType;
      source: ContractDocumentSource;
      existing: { id: string; documentId: string } | null;
      link: { templateId?: string; templateVersion?: number };
      note?: string;
    },
  ) {
    const { existing, link } = options;
    if (existing) {
      await this.documents.addVersion(user, existing.documentId, file, {
        note: options.note,
      });
      return this.prisma.contractDocument.update({
        where: { id: existing.id },
        data: link,
        select: LIST_SELECT,
      });
    }
    const document = await this.documents.upload(
      user,
      contract.customerId,
      file,
      {
        category: DocumentCategory.CONTRACT,
        contractId: contract.id,
        note: options.note,
      },
    );
    try {
      return await this.prisma.contractDocument.create({
        data: {
          ...link,
          contractId: contract.id,
          documentId: document.id,
          type: options.type,
          source: options.source,
          createdById: user.id,
        },
        select: LIST_SELECT,
      });
    } catch (error) {
      await this.documents.remove(user, document.id);
      throw error;
    }
  }

  private requireDocumentUpload(user: AuthUser) {
    if (!hasPermission(user, 'documents', 'create'))
      throw new ForbiddenException('Bạn không có quyền tải hồ sơ lên kho');
  }

  private async findContract(user: AuthUser, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id }),
      select: { id: true, customerId: true, status: true },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    return contract;
  }

  private async findLinked(
    contractId: string,
    documentId: string,
    source: ContractDocumentSource,
  ) {
    const linked = await this.prisma.contractDocument.findFirst({
      where: { contractId, documentId, source, document: { deletedAt: null } },
      select: { id: true, documentId: true, type: true },
    });
    if (!linked)
      throw new BadRequestException(
        source === 'GENERATED'
          ? 'Hồ sơ đã chọn không phải hồ sơ sinh từ mẫu của hợp đồng này'
          : 'Hồ sơ đã chọn không phải bản đã ký của hợp đồng này',
      );
    return linked;
  }

  private async audit(
    user: AuthUser,
    contractId: string,
    action: string,
    detail: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action,
        entity: 'contracts',
        entityId: contractId,
        detail,
      },
    });
  }
}
