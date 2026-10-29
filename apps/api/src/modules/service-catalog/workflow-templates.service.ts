import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingCycle,
  Prisma,
  WorkflowScheduleMode,
  WorkflowVersionStatus,
} from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateWorkflowTemplateDto,
  UpdateWorkflowTemplateDto,
  WorkflowTemplateQueryDto,
} from './dto/workflow.dto';
import {
  isUniqueViolation,
  nextTemplateCode,
  toVersionView,
  VERSION_DETAIL,
} from './workflow.repository';

const LIVE = { deletedAt: null };
const TEMPLATE_SUMMARY = {
  serviceType: { select: { id: true, code: true, name: true } },
  versions: {
    where: LIVE,
    orderBy: { versionNo: 'desc' },
    select: {
      id: true,
      versionNo: true,
      status: true,
      scheduleMode: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { steps: true } },
    },
  },
} satisfies Prisma.WorkflowTemplateInclude;

type TemplateSummary = Prisma.WorkflowTemplateGetPayload<{
  include: typeof TEMPLATE_SUMMARY;
}>;

function withVersionState(template: TemplateSummary) {
  return {
    ...template,
    activeVersion:
      template.versions.find(
        (v) => v.status === WorkflowVersionStatus.PUBLISHED,
      ) ?? null,
    draftVersion:
      template.versions.find((v) => v.status === WorkflowVersionStatus.DRAFT) ??
      null,
  };
}

/** Quy trình mẫu: danh sách, tạo, sửa thông tin, đặt mặc định (đặc tả 03-B). */
@Injectable()
export class WorkflowTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: WorkflowTemplateQueryDto) {
    const search = query.search?.trim();
    const draft = { some: { status: WorkflowVersionStatus.DRAFT, ...LIVE } };
    const where: Prisma.WorkflowTemplateWhereInput = {
      ...LIVE,
      serviceTypeId: query.serviceTypeId,
      ...(query.active && { isActive: query.active === 'true' }),
      ...(query.hasDraft === 'true' && { versions: draft }),
      ...(query.hasDraft === 'false' && { versions: { none: draft.some } }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workflowTemplate.findMany({
        where,
        include: TEMPLATE_SUMMARY,
        orderBy: { code: 'asc' },
        ...toSkipTake(query),
      }),
      this.prisma.workflowTemplate.count({ where }),
    ]);
    return paginated(items.map(withVersionState), total, query);
  }

  async findOne(id: string) {
    const template = await this.prisma.workflowTemplate.findFirst({
      where: { id, ...LIVE },
      include: TEMPLATE_SUMMARY,
    });
    if (!template) throw new NotFoundException('Không tìm thấy quy trình mẫu');
    return withVersionState(template);
  }

  /** Tạo quy trình kèm bản nháp v1 rỗng; dịch vụ một lần mặc định lập lịch theo dự án. */
  async create(user: AuthUser, dto: CreateWorkflowTemplateDto) {
    const service = await this.prisma.serviceType.findUnique({
      where: { id: dto.serviceTypeId },
    });
    if (!service) throw new BadRequestException('Dịch vụ không tồn tại');
    const scheduleMode =
      service.cycle === BillingCycle.ONE_TIME
        ? WorkflowScheduleMode.PROJECT
        : WorkflowScheduleMode.PERIODIC;
    for (let attempt = 1; ; attempt++) {
      try {
        const created = await this.prisma.$transaction(async (tx) =>
          tx.workflowTemplate.create({
            data: {
              code: await nextTemplateCode(tx, service.code),
              serviceTypeId: service.id,
              name: dto.name,
              description: dto.description?.trim() || null,
              createdById: user.id,
              versions: {
                create: { versionNo: 1, scheduleMode, createdById: user.id },
              },
            },
          }),
        );
        return this.findOne(created.id);
      } catch (err) {
        // Hai người tạo cùng lúc trùng mã: lấy lại số tiếp theo.
        if (!isUniqueViolation(err) || attempt >= 3) throw err;
      }
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateWorkflowTemplateDto) {
    const template = await this.findOne(id);
    if (dto.isDefault && !hasPermission(user, 'workflow-templates', 'approve'))
      throw new ForbiddenException(
        'Chỉ người có quyền phát hành được đổi quy trình mặc định',
      );
    if (dto.isDefault && (!template.activeVersion || dto.isActive === false))
      throw new BadRequestException(
        'Quy trình mặc định phải đang dùng và có phiên bản đang hiệu lực',
      );
    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault && !template.isDefault) {
        await tx.workflowTemplate.updateMany({
          where: { serviceTypeId: template.serviceTypeId, isDefault: true },
          data: { isDefault: false },
        });
        await this.audit(tx, user, template, 'SET_DEFAULT');
      }
      await tx.workflowTemplate.update({
        where: { id },
        data: {
          name: dto.name,
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
          isActive: dto.isActive,
          // Ngừng dùng thì không còn là mặc định của dịch vụ.
          isDefault: dto.isActive === false ? false : dto.isDefault,
        },
      });
    });
    return this.findOne(id);
  }

  /** Phiên bản đang hiệu lực của quy trình mặc định, dùng cho hợp đồng và sinh việc. */
  async effectiveForService(serviceTypeId: string) {
    const version = await this.prisma.workflowTemplateVersion.findFirst({
      where: {
        status: WorkflowVersionStatus.PUBLISHED,
        ...LIVE,
        template: { serviceTypeId, isDefault: true, isActive: true, ...LIVE },
      },
      include: VERSION_DETAIL,
    });
    if (!version)
      throw new NotFoundException(
        'Dịch vụ chưa có quy trình mặc định đang hiệu lực',
      );
    return toVersionView(version);
  }

  private async audit(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    template: { id: string; code: string },
    action: string,
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'APPROVE',
        entity: 'workflow-templates',
        entityId: template.id,
        detail: { code: template.code, operation: action },
      },
    });
  }
}
