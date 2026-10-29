import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, toSkipTake } from '../../common/types/paginated';
import { customerScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  StorageService,
  UploadedFileInfo,
} from '../../core/storage/storage.service';
import { validateDocumentFile } from './document-file.util';
import {
  DocumentQueryDto,
  UploadDocumentDto,
  UploadVersionDto,
} from './dto/document.dto';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const DOCUMENT_SELECT = {
  id: true,
  customerId: true,
  contractId: true,
  taskId: true,
  category: true,
  period: true,
  fileName: true,
  mimeType: true,
  size: true,
  note: true,
  version: true,
  createdAt: true,
  uploadedBy: { select: { id: true, fullName: true } },
  contract: { select: { id: true, code: true } },
  task: { select: { id: true, title: true } },
} as const;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(user: AuthUser, customerId: string, query: DocumentQueryDto) {
    await this.ensureCustomer(user, customerId);
    const where: Prisma.DocumentWhereInput = {
      customerId,
      deletedAt: null,
      category: query.category,
      contractId: query.contractId,
      period: query.period,
      ...(query.search && {
        OR: [
          { fileName: { contains: query.search, mode: 'insensitive' } },
          { note: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        select: DOCUMENT_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.document.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async upload(
    user: AuthUser,
    customerId: string,
    file: UploadedFileInfo | undefined,
    dto: UploadDocumentDto,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file tải lên');
    await this.ensureCustomer(user, customerId);
    if (dto.contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: { id: dto.contractId, customerId, deletedAt: null },
        select: { id: true },
      });
      if (!contract)
        throw new BadRequestException('Hợp đồng không thuộc khách hàng này');
    }
    const stored = await this.storage.save(validateDocumentFile(file));
    try {
      return await this.prisma.document.create({
        data: {
          ...dto,
          ...stored,
          customerId,
          uploadedById: user.id,
          versions: {
            create: {
              ...stored,
              version: 1,
              uploadedById: user.id,
              note: dto.note,
            },
          },
        },
        select: DOCUMENT_SELECT,
      });
    } catch (error) {
      await this.storage.remove(stored.storedName);
      throw error;
    }
  }

  async addVersion(
    user: AuthUser,
    id: string,
    file: UploadedFileInfo | undefined,
    dto: UploadVersionDto,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file tải lên');
    await this.findInScope(user, id);
    const stored = await this.storage.save(validateDocumentFile(file));
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM documents WHERE id = ${id}::uuid FOR UPDATE`;
        const document = await this.findInScope(user, id, tx);
        if (document.version === 1)
          await tx.documentVersion.upsert({
            where: { documentId_version: { documentId: id, version: 1 } },
            update: {},
            create: {
              documentId: id,
              version: 1,
              fileName: document.fileName,
              storedName: document.storedName,
              mimeType: document.mimeType,
              size: document.size,
              note: document.note,
              uploadedById: document.uploadedById,
              createdAt: document.createdAt,
            },
          });
        const version = document.version + 1;
        await tx.documentVersion.create({
          data: {
            ...stored,
            documentId: id,
            version,
            uploadedById: user.id,
            note: dto.note,
          },
        });
        return tx.document.update({
          where: { id },
          data: {
            ...stored,
            version,
            uploadedById: user.id,
            note: dto.note ?? null,
          },
          select: DOCUMENT_SELECT,
        });
      });
    } catch (error) {
      await this.storage.remove(stored.storedName);
      throw error;
    }
  }

  async versions(user: AuthUser, id: string, query: PaginationQueryDto) {
    const document = await this.findInScope(user, id);
    const where = { documentId: id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.documentVersion.findMany({
        where,
        select: {
          id: true,
          version: true,
          fileName: true,
          mimeType: true,
          size: true,
          note: true,
          uploadedById: true,
          createdAt: true,
        },
        orderBy: { version: 'desc' },
        ...toSkipTake(query),
      }),
      this.prisma.documentVersion.count({ where }),
    ]);
    if (!total && document.version === 1) {
      const legacy = {
        id: document.id,
        version: 1,
        fileName: document.fileName,
        mimeType: document.mimeType,
        size: document.size,
        note: document.note,
        uploadedById: document.uploadedById,
        createdAt: document.createdAt,
      };
      return paginated(query.page === 1 ? [legacy] : [], 1, query);
    }
    return paginated(items, total, query);
  }

  async fileOf(user: AuthUser, id: string, version?: number, preview = false) {
    const document = await this.findInScope(user, id);
    const historical =
      version === undefined
        ? document
        : await this.prisma.documentVersion.findUnique({
            where: { documentId_version: { documentId: id, version } },
          });
    const file = historical ?? (version === document.version ? document : null);
    if (!file) throw new NotFoundException('Không tìm thấy phiên bản tài liệu');
    if (
      preview &&
      !['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimeType)
    )
      throw new BadRequestException(
        'Chỉ xem trước PDF, PNG hoặc JPEG; vui lòng tải file Office về',
      );
    return {
      path: this.storage.pathOf(file.storedName),
      fileName: file.fileName,
      mimeType: file.mimeType,
    };
  }

  remove(user: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM documents WHERE id = ${id}::uuid FOR UPDATE`;
      await this.findInScope(user, id, tx);
      return tx.document.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: { id: true },
      });
    });
  }

  private async findInScope(
    user: AuthUser,
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const document = await tx.document.findFirst({
      where: {
        id,
        deletedAt: null,
        customer: { AND: [{ deletedAt: null }, customerScope(user)] },
      },
    });
    if (!document) throw new NotFoundException('Không tìm thấy tài liệu');
    return document;
  }

  private async ensureCustomer(user: AuthUser, customerId: string) {
    const found = await this.prisma.customer.findFirst({
      where: {
        AND: [{ id: customerId, deletedAt: null }, customerScope(user)],
      },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Không tìm thấy khách hàng');
  }
}
