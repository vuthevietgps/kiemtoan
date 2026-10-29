import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkflowVersionStatus } from '@prisma/client';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  formatBusinessDate,
  todayVn,
  toBusinessDate,
} from '../reports/utils/period.util';
import {
  CloneWorkflowVersionDto,
  SaveWorkflowVersionDto,
  WorkflowPreviewQueryDto,
} from './dto/workflow.dto';
import { loadWorkingCalendar } from '../deadlines/working-calendar.loader';
import { scheduleSteps } from './workflow-schedule.util';
import {
  assertActiveUsers,
  assertObligationTypes,
  isUniqueViolation,
  nextTemplateCode,
  toStepInputs,
  toVersionView,
  VERSION_DETAIL,
  writeRequirements,
  writeSteps,
} from './workflow.repository';
import {
  publishError,
  requirementError,
  structureError,
} from './workflow.util';

const { DRAFT, PUBLISHED, RETIRED } = WorkflowVersionStatus;
const NOT_DRAFT =
  'Chỉ sửa được bản nháp; phiên bản đã phát hành hãy nhân bản thành bản nháp mới';

/** Vòng đời phiên bản quy trình: lưu nháp, nhân bản, phát hành, xoá nháp, xem trước. */
@Injectable()
export class WorkflowVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const version = await this.prisma.workflowTemplateVersion.findFirst({
      where: { id, deletedAt: null, template: { deletedAt: null } },
      include: VERSION_DETAIL,
    });
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản');
    return toVersionView(version);
  }

  /** Ghi đè nội dung bản nháp; lệch revision trả 409 để không ghi đè người khác. */
  async save(id: string, dto: SaveWorkflowVersionDto) {
    const current = await this.findOne(id);
    if (current.status !== DRAFT) throw new ConflictException(NOT_DRAFT);
    // Không gửi requirements thì giữ danh sách hiện có (gắn lại theo khoá bước).
    const requirements = dto.requirements ?? current.requirements;
    const error =
      structureError(toInputs(dto)) ??
      requirementError(dto.steps, requirements);
    if (error) throw new BadRequestException(error);
    await assertActiveUsers(this.prisma, dto.steps);
    await assertObligationTypes(this.prisma, dto.steps);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.workflowTemplateVersion.updateMany({
        where: { id, status: DRAFT, revision: dto.revision, deletedAt: null },
        data: {
          revision: { increment: 1 },
          scheduleMode: dto.scheduleMode,
          note: dto.note?.trim() || null,
        },
      });
      if (count === 0)
        throw new ConflictException(
          'Bản nháp đã được người khác sửa hoặc không còn là bản nháp; vui lòng tải lại',
        );
      await tx.documentRequirement.deleteMany({ where: { versionId: id } });
      await tx.workflowStep.deleteMany({ where: { versionId: id } });
      const stepIds = await writeSteps(tx, id, dto.steps);
      await writeRequirements(tx, id, requirements, stepIds);
    });
    return this.findOne(id);
  }

  /**
   * Nhân bản: không có serviceTypeId → bản nháp mới trong cùng quy trình (409 nếu đã có nháp);
   * có serviceTypeId → quy trình mới cho dịch vụ đó. Phiên bản gốc không đổi.
   */
  async clone(user: AuthUser, id: string, dto: CloneWorkflowVersionDto) {
    const source = await this.findOne(id);
    const steps = toStepInputs(source);
    try {
      const versionId = await this.prisma.$transaction(async (tx) => {
        const templateId = dto.serviceTypeId
          ? await this.createTemplate(tx, user, dto, source.template.name)
          : source.template.id;
        const last = await tx.workflowTemplateVersion.aggregate({
          where: { templateId },
          _max: { versionNo: true },
        });
        const version = await tx.workflowTemplateVersion.create({
          data: {
            templateId,
            versionNo: (last._max.versionNo ?? 0) + 1,
            scheduleMode: source.scheduleMode,
            note: source.note,
            clonedFromId: source.id,
            createdById: user.id,
          },
        });
        const stepIds = await writeSteps(tx, version.id, steps);
        await writeRequirements(tx, version.id, source.requirements, stepIds);
        return version.id;
      });
      return this.findOne(versionId);
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException(
          'Quy trình đã có bản nháp; hãy sửa hoặc xoá bản nháp đó trước',
        );
      throw err;
    }
  }

  /** Phát hành: bản nháp → đang hiệu lực, bản đang hiệu lực cũ → ngừng, trong một transaction. */
  async publish(user: AuthUser, id: string) {
    const draft = await this.findOne(id);
    if (draft.status !== DRAFT) throw new ConflictException(NOT_DRAFT);
    const steps = toStepInputs(draft);
    const error =
      publishError(draft.scheduleMode, toInputs({ steps })) ??
      requirementError(steps, draft.requirements);
    if (error) throw new BadRequestException(error);
    await assertActiveUsers(this.prisma, steps);
    await assertObligationTypes(this.prisma, steps);
    const templateId = draft.template.id;
    try {
      await this.prisma.$transaction(async (tx) => {
        const previous = await tx.workflowTemplateVersion.findFirst({
          where: { templateId, status: PUBLISHED, deletedAt: null },
          select: { id: true, versionNo: true },
        });
        if (previous)
          await tx.workflowTemplateVersion.update({
            where: { id: previous.id },
            data: { status: RETIRED, retiredAt: new Date() },
          });
        const { count } = await tx.workflowTemplateVersion.updateMany({
          where: { id, status: DRAFT, deletedAt: null },
          data: {
            status: PUBLISHED,
            publishedAt: new Date(),
            publishedById: user.id,
          },
        });
        if (count === 0) throw new ConflictException(NOT_DRAFT);
        await this.makeDefaultIfNone(tx, templateId);
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'APPROVE',
            entity: 'workflow-templates',
            entityId: templateId,
            detail: {
              code: draft.template.code,
              operation: 'PUBLISH',
              fromVersion: previous?.versionNo ?? null,
              toVersion: draft.versionNo,
              steps: steps.length,
            },
          },
        });
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(NOT_DRAFT);
      throw err;
    }
    return this.findOne(id);
  }

  /** Xoá mềm bản nháp. Quy trình chưa từng phát hành thì xoá mềm luôn quy trình. */
  async remove(id: string) {
    const draft = await this.findOne(id);
    if (draft.status !== DRAFT)
      throw new ConflictException('Chỉ xoá được bản nháp chưa phát hành');
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.workflowTemplateVersion.updateMany({
        where: { id, status: DRAFT, deletedAt: null },
        data: { deletedAt: now },
      });
      if (count === 0)
        throw new ConflictException('Chỉ xoá được bản nháp chưa phát hành');
      const others = await tx.workflowTemplateVersion.count({
        where: { templateId: draft.template.id, deletedAt: null },
      });
      if (others === 0)
        await tx.workflowTemplate.update({
          where: { id: draft.template.id },
          data: { deletedAt: now, isDefault: false },
        });
    });
    return { id };
  }

  /** Lịch dự kiến; mặc định bắt đầu hôm nay, kỳ là tháng hiện tại. */
  async preview(id: string, query: WorkflowPreviewQueryDto) {
    const version = await this.findOne(id);
    const startDate = query.startDate
      ? toBusinessDate(query.startDate)
      : todayVn();
    const period = query.period ?? formatBusinessDate(startDate).slice(0, 7);
    const schedule = scheduleSteps(version.scheduleMode, version.steps, {
      startDate,
      period,
      calendar: await loadWorkingCalendar(this.prisma),
    });
    const names = new Map(version.steps.map((s) => [s.key, s]));
    return {
      scheduleMode: version.scheduleMode,
      startDate: formatBusinessDate(startDate),
      period,
      totalWorkingDays: schedule.totalWorkingDays,
      steps: schedule.steps.map((s) => ({
        key: s.key,
        name: names.get(s.key)!.name,
        phase: names.get(s.key)!.phase,
        start: s.start && formatBusinessDate(s.start),
        end: formatBusinessDate(s.end),
      })),
    };
  }

  private async createTemplate(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    dto: CloneWorkflowVersionDto,
    sourceName: string,
  ): Promise<string> {
    const service = await tx.serviceType.findUnique({
      where: { id: dto.serviceTypeId },
    });
    if (!service) throw new BadRequestException('Dịch vụ không tồn tại');
    const template = await tx.workflowTemplate.create({
      data: {
        code: await nextTemplateCode(tx, service.code),
        serviceTypeId: service.id,
        name: dto.name ?? `${sourceName} (bản sao)`,
        createdById: user.id,
      },
    });
    return template.id;
  }

  /** Lần phát hành đầu tiên: quy trình thành mặc định nếu dịch vụ chưa có quy trình mặc định. */
  private async makeDefaultIfNone(
    tx: Prisma.TransactionClient,
    templateId: string,
  ) {
    const template = await tx.workflowTemplate.findUniqueOrThrow({
      where: { id: templateId },
    });
    if (template.isDefault || !template.isActive) return;
    const existing = await tx.workflowTemplate.count({
      where: {
        serviceTypeId: template.serviceTypeId,
        isDefault: true,
        deletedAt: null,
      },
    });
    if (existing === 0)
      await tx.workflowTemplate.update({
        where: { id: templateId },
        data: { isDefault: true },
      });
  }
}

function toInputs(dto: Pick<SaveWorkflowVersionDto, 'steps'>) {
  return dto.steps.map((s) => ({
    key: s.key,
    name: s.name,
    dependsOn: s.dependsOn,
    durationDays: s.durationDays,
    dueOffsetDays: s.dueOffsetDays,
    reviewLevels: s.reviewLevels ?? 0,
    reviewerRole: s.reviewerRole,
    defaultReviewerId: s.defaultReviewerId,
  }));
}
