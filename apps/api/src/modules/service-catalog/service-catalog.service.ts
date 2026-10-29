import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkflowVersionStatus } from '@prisma/client';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateServiceTypeDto,
  ServiceTypeQueryDto,
  UpdateServiceTypeDto,
} from './dto/service-type.dto';

/** Quy trình mặc định và phiên bản đang hiệu lực của dịch vụ (đặc tả 03-B). */
const WITH_WORKFLOW = {
  workflowTemplates: {
    where: { isDefault: true, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      versions: {
        where: { status: WorkflowVersionStatus.PUBLISHED, deletedAt: null },
        select: {
          id: true,
          versionNo: true,
          _count: { select: { steps: true } },
        },
      },
    },
  },
} satisfies Prisma.ServiceTypeInclude;

type ServiceWithWorkflow = Prisma.ServiceTypeGetPayload<{
  include: typeof WITH_WORKFLOW;
}>;

function withDefaultWorkflow({
  workflowTemplates,
  ...service
}: ServiceWithWorkflow) {
  const template = workflowTemplates[0];
  const version = template?.versions[0];
  return {
    ...service,
    defaultWorkflow: template
      ? {
          templateId: template.id,
          code: template.code,
          name: template.name,
          versionId: version?.id ?? null,
          versionNo: version?.versionNo ?? null,
          stepCount: version?._count.steps ?? 0,
        }
      : null,
  };
}

/** Trường được ghi trước–sau vào nhật ký khi sửa dịch vụ. */
const AUDITED_FIELDS = [
  'code',
  'name',
  'cycle',
  'defaultPrice',
  'pricingBasis',
  'pricingUnit',
  'isActive',
  'issuesAuditReport',
] as const;

function normalizeUnit(unit: string | null | undefined) {
  if (unit === undefined) return undefined;
  return unit?.trim() || null;
}

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Danh mục nhỏ (vài chục dịch vụ) nên trả đủ danh sách, form hợp đồng dùng để chọn. */
  async findAll(query: ServiceTypeQueryDto = {}) {
    const search = query.search?.trim();
    const items = await this.prisma.serviceType.findMany({
      where: {
        ...(query.active && { isActive: query.active === 'true' }),
        ...(search && {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: WITH_WORKFLOW,
      orderBy: { code: 'asc' },
    });
    return items.map(withDefaultWorkflow);
  }

  async findOne(id: string) {
    const item = await this.prisma.serviceType.findUnique({
      where: { id },
      include: WITH_WORKFLOW,
    });
    if (!item) throw new NotFoundException('Không tìm thấy dịch vụ');
    return withDefaultWorkflow(item);
  }

  async create(dto: CreateServiceTypeDto) {
    await this.ensureCodeFree(dto.code);
    const created = await this.prisma.serviceType.create({
      data: {
        ...dto,
        code: dto.code.trim().toUpperCase(),
        pricingUnit: normalizeUnit(dto.pricingUnit),
      },
      include: WITH_WORKFLOW,
    });
    return withDefaultWorkflow(created);
  }

  async update(user: AuthUser, id: string, dto: UpdateServiceTypeDto) {
    const before = await this.findOne(id);
    if (dto.code) await this.ensureCodeFree(dto.code, id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceType.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.code && { code: dto.code.trim().toUpperCase() }),
          pricingUnit: normalizeUnit(dto.pricingUnit),
        },
        include: WITH_WORKFLOW,
      });
      const after = withDefaultWorkflow(updated);
      const changed = AUDITED_FIELDS.filter(
        (field) => String(before[field]) !== String(after[field]),
      );
      if (changed.length > 0) {
        const pick = (row: typeof before) =>
          Object.fromEntries(changed.map((f) => [f, String(row[f])]));
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'SERVICE_UPDATE',
            entity: 'service-types',
            entityId: id,
            detail: { before: pick(before), after: pick(after) },
          },
        });
      }
      return after;
    });
  }

  private async ensureCodeFree(code: string, exceptId?: string) {
    const exists = await this.prisma.serviceType.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (exists && exists.id !== exceptId) {
      throw new ConflictException('Mã dịch vụ đã tồn tại');
    }
  }
}
