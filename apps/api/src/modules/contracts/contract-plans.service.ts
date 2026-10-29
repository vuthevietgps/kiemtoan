import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ContractPlanStatus,
  ContractStatus,
  Prisma,
  TaskGenerationStatus,
  WorkflowVersionStatus,
} from '@prisma/client';
import {
  CONTRACT_TASKS_REQUESTED,
  ContractApprovedEvent,
} from '../../common/events/app-events';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { toBusinessDate } from '../reports/utils/period.util';
import {
  activeUserIds,
  applyStepChanges,
  confirmPlan,
  createPlan,
  inactiveDefaultWarnings,
  PlanError,
  recomputeDates,
  scheduleDates,
} from './contract-plan.builder';
import { loadWorkingCalendar } from '../deadlines/working-calendar.loader';
import { periodProgress } from '../tasks/task-progress';
import { scopedContract } from './contracts-query.service';
import {
  CreatePlanDto,
  PreviewPlanDto,
  UpdatePlanDto,
} from './dto/contract-plan.dto';

/** HĐ còn được lập/sửa kế hoạch (chưa hoàn thành, thanh lý, huỷ). */
const PLANNABLE: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.PENDING_APPROVAL,
  ContractStatus.NOT_STARTED,
  ContractStatus.IN_PROGRESS,
];
/** HĐ đã duyệt: xác nhận kế hoạch thì sinh việc ngay (E1). */
const APPROVED: ContractStatus[] = [
  ContractStatus.NOT_STARTED,
  ContractStatus.IN_PROGRESS,
];

const PLAN_DETAIL = {
  // Trạng thái việc của từng bước để hiển thị tiến độ theo giai đoạn (04-D, PL1 VII.3).
  steps: {
    orderBy: { sortOrder: 'asc' },
    include: {
      tasks: {
        where: { deletedAt: null },
        select: { status: true, period: true },
        orderBy: { period: 'asc' },
      },
    },
  },
  requirements: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ContractServicePlanInclude;

/** Kế hoạch thực hiện của các dòng dịch vụ (đặc tả 04-B). */
@Injectable()
export class ContractPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Mỗi dòng dịch vụ kèm kế hoạch (nếu có) và các phiên bản quy trình đang hiệu lực của dịch vụ. */
  async list(user: AuthUser, contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id: contractId }),
      select: {
        id: true,
        status: true,
        services: {
          select: {
            id: true,
            period: true,
            serviceTypeId: true,
            taskGenerationStatus: true,
            taskGenerationMessage: true,
            serviceType: { select: { code: true, name: true } },
            plan: { include: PLAN_DETAIL },
          },
        },
      },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    const versions = await this.prisma.workflowTemplateVersion.findMany({
      where: {
        status: WorkflowVersionStatus.PUBLISHED,
        deletedAt: null,
        template: {
          isActive: true,
          deletedAt: null,
          serviceTypeId: { in: contract.services.map((s) => s.serviceTypeId) },
        },
      },
      select: {
        id: true,
        versionNo: true,
        template: {
          select: {
            code: true,
            name: true,
            isDefault: true,
            serviceTypeId: true,
          },
        },
      },
    });
    // Cảnh báo người mặc định đã nghỉ chỉ cần khi còn rà soát (kế hoạch nháp).
    const warnings = await inactiveDefaultWarnings(
      this.prisma,
      contract.services.flatMap((s) =>
        s.plan?.status === ContractPlanStatus.DRAFT
          ? s.plan.steps.map((step) => step.sourceStepId)
          : [],
      ),
    );
    return {
      contractId: contract.id,
      status: contract.status,
      lines: contract.services.map((line) => ({
        ...line,
        // Tiến độ từng kỳ của dòng (05-C): kỳ hoàn tất khi mọi việc bắt buộc Hoàn thành.
        periods: periodProgress(
          (line.plan?.steps ?? []).flatMap((step) =>
            step.tasks.map((t) => ({ ...t, required: step.required })),
          ),
        ),
        plan: line.plan && {
          ...line.plan,
          steps: line.plan.steps.map((step) => ({
            ...step,
            warning:
              line.plan?.status === ContractPlanStatus.DRAFT &&
              step.sourceStepId
                ? (warnings.get(step.sourceStepId) ?? null)
                : null,
          })),
        },
        workflowOptions: versions.filter(
          (v) => v.template.serviceTypeId === line.serviceTypeId,
        ),
      })),
    };
  }

  async create(
    user: AuthUser,
    contractId: string,
    lineId: string,
    dto: CreatePlanDto,
  ) {
    await this.findLine(user, contractId, lineId);
    const planId = await this.run(() =>
      this.prisma.$transaction((tx) =>
        createPlan(tx, lineId, {
          workflowVersionId: dto.workflowVersionId,
          startDate: dto.startDate ? toBusinessDate(dto.startDate) : undefined,
          period: dto.period,
          userId: user.id,
        }),
      ),
    );
    return this.detail(planId);
  }

  /** Sửa kế hoạch nháp: bỏ bước tuỳ chọn, đổi người, thời lượng/hạn, ngày bắt đầu/kỳ. */
  async update(user: AuthUser, planId: string, dto: UpdatePlanDto) {
    const plan = await this.findPlan(user, planId);
    if (plan.status !== ContractPlanStatus.DRAFT)
      throw new ConflictException(
        'Kế hoạch đã xác nhận; hãy mở lại trước khi sửa',
      );
    this.check(() => applyStepChanges(plan.steps, dto.steps));
    const byKey = new Map(plan.steps.map((s) => [s.stepKey, s]));
    const people = dto.steps.flatMap((s) => [
      s.assigneeId,
      s.reviewerId,
      s.approverId,
    ]);
    const active = await activeUserIds(this.prisma, people);
    if (people.some((id) => id && !active.has(id)))
      throw new BadRequestException(
        'Người được chọn phải là nhân sự đang hoạt động',
      );
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.contractServicePlan.updateMany({
        where: {
          id: planId,
          status: ContractPlanStatus.DRAFT,
          revision: dto.revision,
        },
        data: {
          revision: { increment: 1 },
          ...(dto.startDate && { startDate: toBusinessDate(dto.startDate) }),
          ...(dto.period && { period: dto.period }),
          ...(dto.note !== undefined && { note: dto.note?.trim() || null }),
        },
      });
      if (count === 0)
        throw new ConflictException(
          'Kế hoạch đã được người khác sửa; vui lòng tải lại',
        );
      for (const change of dto.steps) {
        await tx.contractPlanStep.update({
          where: { id: byKey.get(change.stepKey)!.id },
          data: {
            skipped: change.skipped,
            assigneeId: change.assigneeId,
            reviewerId: change.reviewerId,
            approverId: change.approverId,
            durationDays: change.durationDays,
            dueOffsetDays: change.dueOffsetDays,
          },
        });
      }
      await recomputeDates(tx, planId);
    });
    return this.detail(planId);
  }

  /** Lịch các bước nếu áp thay đổi chưa lưu (không ghi DB). */
  async preview(user: AuthUser, planId: string, dto: PreviewPlanDto) {
    const plan = await this.findPlan(user, planId);
    const steps = this.check(() =>
      applyStepChanges(
        [...plan.steps].sort((a, b) => a.sortOrder - b.sortOrder),
        dto.steps,
      ),
    );
    const dates = scheduleDates(
      plan.scheduleMode,
      steps,
      dto.startDate ? toBusinessDate(dto.startDate) : plan.startDate,
      dto.period ?? plan.period,
      await loadWorkingCalendar(this.prisma),
    );
    return steps.map((s) => ({
      stepKey: s.stepKey,
      skipped: s.skipped,
      ...dates.get(s.stepKey)!,
    }));
  }

  /** Xác nhận: khoá kế hoạch; HĐ đã duyệt thì sinh việc ngay (E1). */
  async confirm(user: AuthUser, planId: string) {
    const plan = await this.findPlan(user, planId);
    await this.run(() =>
      this.prisma.$transaction(async (tx) => {
        await confirmPlan(tx, planId, user.id);
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'PLAN_CONFIRM',
            entity: 'contracts',
            entityId: plan.contractService.contractId,
            detail: {
              planId,
              workflow: plan.workflowCode,
              version: plan.workflowVersionNo,
              steps: plan.steps.filter((s) => !s.skipped).length,
            },
          },
        });
      }),
    );
    if (APPROVED.includes(plan.contractService.contract.status)) {
      const event: ContractApprovedEvent = {
        contractId: plan.contractService.contractId,
        approvedById: user.id,
      };
      await this.events.emitAsync(CONTRACT_TASKS_REQUESTED, event);
    }
    return this.detail(planId);
  }

  /** Mở lại kế hoạch đã xác nhận khi chưa sinh việc từ kế hoạch này. */
  async reopen(user: AuthUser, planId: string) {
    const plan = await this.findPlan(user, planId);
    const generated = await this.prisma.task.count({
      where: { planStep: { planId } },
    });
    if (
      generated > 0 ||
      plan.contractService.taskGenerationStatus === TaskGenerationStatus.DONE
    )
      throw new ConflictException(
        'Đã sinh việc từ kế hoạch này, không mở lại được',
      );
    const { count } = await this.prisma.contractServicePlan.updateMany({
      where: { id: planId, status: ContractPlanStatus.CONFIRMED },
      data: {
        status: ContractPlanStatus.DRAFT,
        confirmedAt: null,
        confirmedById: null,
      },
    });
    if (count === 0)
      throw new ConflictException('Kế hoạch không ở trạng thái đã xác nhận');
    return this.detail(planId);
  }

  private detail(planId: string) {
    return this.prisma.contractServicePlan.findUniqueOrThrow({
      where: { id: planId },
      include: PLAN_DETAIL,
    });
  }

  private async findLine(user: AuthUser, contractId: string, lineId: string) {
    const line = await this.prisma.contractService.findFirst({
      where: { id: lineId, contract: scopedContract(user, { id: contractId }) },
      select: { id: true, contract: { select: { status: true } } },
    });
    if (!line) throw new NotFoundException('Không tìm thấy dòng dịch vụ');
    if (!PLANNABLE.includes(line.contract.status))
      throw new BadRequestException(
        'Hợp đồng đã kết thúc hoặc huỷ, không lập kế hoạch',
      );
    return line;
  }

  private async findPlan(user: AuthUser, planId: string) {
    const plan = await this.prisma.contractServicePlan.findFirst({
      where: {
        id: planId,
        contractService: { contract: scopedContract(user, {}) },
      },
      include: {
        steps: true,
        contractService: {
          select: {
            contractId: true,
            taskGenerationStatus: true,
            contract: { select: { status: true } },
          },
        },
      },
    });
    if (!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
    if (!PLANNABLE.includes(plan.contractService.contract.status))
      throw new BadRequestException(
        'Hợp đồng đã kết thúc hoặc huỷ, không sửa kế hoạch',
      );
    return plan;
  }

  /** Đổi lỗi nghiệp vụ của builder sang HTTP 400/409. */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      return this.rethrow(err);
    }
  }

  private check<T>(fn: () => T): T {
    try {
      return fn();
    } catch (err) {
      return this.rethrow(err);
    }
  }

  private rethrow(err: unknown): never {
    if (err instanceof PlanError)
      throw err.kind === 'conflict'
        ? new ConflictException(err.message)
        : new BadRequestException(err.message);
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    )
      throw new ConflictException(
        'Kế hoạch vừa được người khác lập; vui lòng tải lại',
      );
    throw err;
  }
}
