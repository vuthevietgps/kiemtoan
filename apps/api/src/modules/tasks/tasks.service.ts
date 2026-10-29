import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DocumentCategory, Prisma, Task, TaskStatus } from '@prisma/client';
import {
  CONTRACT_APPROVED,
  CONTRACT_TASKS_REQUESTED,
  type ContractApprovedEvent,
  TASK_ASSIGNED,
  type TaskAssignedEvent,
} from '../../common/events/app-events';
import { customerScope } from '../../core/access-control/data-scope';
import { AuditService } from '../../core/audit/audit.service';
import { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  StorageService,
  UploadedFileInfo,
} from '../../core/storage/storage.service';
import { BulkReassignDto, CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { baseTaskWhere } from './task-filters';
import { TaskAccess } from './task-access';
import { generateTasks, periodOfDate } from './task-generator';

/** Trạng thái đang/đã soát xét: không đổi số cấp duyệt nữa. */
const REVIEW_LOCKED: TaskStatus[] = [
  TaskStatus.IN_REVIEW,
  TaskStatus.APPROVED,
  TaskStatus.COMPLETED,
];

/** Trường chỉ người quản lý việc được đổi. */
const MANAGED_KEYS = [
  'assigneeId',
  'reviewerId',
  'approverId',
  'reviewLevels',
  'priority',
] as const;
type ManagedChanges = Partial<Pick<Task, (typeof MANAGED_KEYS)[number]>>;

/** Tạo, sửa, giao lại, bằng chứng công việc; luồng trạng thái ở TaskWorkflowService. */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
    private readonly access: TaskAccess,
  ) {}

  /** HĐ được duyệt hoặc yêu cầu sinh lại → sinh công việc và báo cho người được giao. */
  @OnEvent(CONTRACT_APPROVED)
  @OnEvent(CONTRACT_TASKS_REQUESTED)
  async onContractApproved(event: ContractApprovedEvent): Promise<number> {
    try {
      const created = await generateTasks(
        this.prisma,
        event.contractId,
        (message) => this.logger.warn(message),
      );
      for (const task of created.filter((t) => t.notify))
        await this.notifyAssigned(task);
      return created.length;
    } catch (err) {
      this.logger.error(
        `Không sinh được công việc cho HĐ ${event.contractId}`,
        err,
      );
      return 0;
    }
  }

  async create(user: AuthUser, dto: CreateTaskDto) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        AND: [{ id: dto.customerId, deletedAt: null }, customerScope(user)],
      },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    if (dto.contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: {
          id: dto.contractId,
          customerId: dto.customerId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!contract) {
        throw new BadRequestException(
          'Hợp đồng không thuộc khách hàng đã chọn',
        );
      }
    }
    const reviewLevels = dto.reviewLevels ?? 0;
    const reviewerId = reviewLevels >= 1 ? (dto.reviewerId ?? null) : null;
    const approverId = reviewLevels >= 2 ? (dto.approverId ?? null) : null;
    for (const id of [dto.assigneeId, reviewerId, approverId])
      if (id) await this.ensureActiveUser(id);
    const dueDate = new Date(dto.dueDate);
    const task = await this.prisma.task.create({
      data: {
        customerId: dto.customerId,
        contractId: dto.contractId ?? null,
        title: dto.title.trim(),
        dueDate,
        originalDueDate: dueDate,
        period: dto.period ?? periodOfDate(dueDate),
        requiresEvidence: dto.requiresEvidence ?? true,
        requiresDelivery: dto.requiresDelivery ?? false,
        priority: dto.priority,
        reviewLevels,
        reviewerId,
        approverId,
        assigneeId: dto.assigneeId ?? null,
        note: dto.note,
        createdById: user.id,
        statusEvents: {
          create: { toStatus: TaskStatus.NOT_STARTED, actorId: user.id },
        },
      },
    });
    await this.notifyAssigned(task);
    return task;
  }

  async update(user: AuthUser, id: string, dto: UpdateTaskDto) {
    const task = await this.access.findInScope(user, id);
    // H7: hạn sau khi giao chỉ đổi qua đề nghị/duyệt gia hạn (giữ hạn gốc và lịch sử).
    if (
      dto.dueDate &&
      new Date(dto.dueDate).getTime() !== task.dueDate.getTime()
    )
      throw new BadRequestException(
        'Đổi hạn công việc phải qua đề nghị gia hạn',
      );
    const data: Prisma.TaskUncheckedUpdateInput = {
      title: dto.title?.trim(),
      note: dto.note,
    };
    const managed = this.managedChanges(task, dto);
    if (Object.keys(managed).length) {
      // R2: quyền hiệu lực (vai trò tùy chỉnh) hoặc Manager dòng dịch vụ, không theo vai trò gốc.
      if (!(await this.access.canManage(user, task)))
        throw new ForbiddenException(
          'Chỉ người quản lý việc được giao lại, đổi người soát xét, số cấp duyệt hoặc ưu tiên',
        );
      if (
        managed.reviewLevels !== undefined &&
        REVIEW_LOCKED.includes(task.status)
      )
        throw new BadRequestException(
          'Không đổi số cấp duyệt khi việc đang hoặc đã soát xét',
        );
      for (const person of [
        managed.assigneeId,
        managed.reviewerId,
        managed.approverId,
      ])
        if (person) await this.ensureActiveUser(person);
      Object.assign(data, managed);
    }
    if (dto.progress !== undefined && dto.progress !== task.progress) {
      if (task.status === TaskStatus.COMPLETED)
        throw new BadRequestException('Việc đã hoàn thành');
      if (
        task.assigneeId !== user.id &&
        !(await this.access.canManage(user, task))
      )
        throw new ForbiddenException(
          'Chỉ người thực hiện cập nhật tỷ lệ hoàn thành',
        );
      data.progress = dto.progress;
    }
    const updated = await this.prisma.task.update({ where: { id }, data });
    if (managed.assigneeId !== undefined) await this.notifyAssigned(updated);
    return updated;
  }

  /**
   * Giao lại hàng loạt (05-E): từng việc phải trong phạm vi và người thao tác là người quản lý việc
   * (R2); việc đã hoàn thành hoặc không đủ quyền thì bỏ qua và báo lý do. Người mới nhận thông báo.
   */
  async reassign(user: AuthUser, dto: BulkReassignDto) {
    await this.ensureActiveUser(dto.assigneeId);
    const updated: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    for (const id of [...new Set(dto.taskIds)]) {
      const task = await this.prisma.task.findFirst({
        where: { AND: [...baseTaskWhere(user), { id }] },
      });
      if (!task) {
        skipped.push({ id, reason: 'Không tìm thấy công việc' });
        continue;
      }
      if (task.status === TaskStatus.COMPLETED) {
        skipped.push({ id, reason: 'Việc đã hoàn thành' });
        continue;
      }
      if (!(await this.access.canManage(user, task))) {
        skipped.push({ id, reason: 'Không phải người quản lý việc' });
        continue;
      }
      if (task.assigneeId === dto.assigneeId) {
        skipped.push({ id, reason: 'Đã giao cho người này' });
        continue;
      }
      const next = await this.prisma.task.update({
        where: { id },
        data: { assigneeId: dto.assigneeId },
      });
      await this.audit.log(user.id, 'REASSIGN', 'tasks', id, {
        from: task.assigneeId,
        to: dto.assigneeId,
      });
      await this.notifyAssigned(next);
      updated.push(id);
    }
    return { updated, skipped };
  }

  /** Chỉ lấy các trường quản lý thực sự thay đổi. */
  private managedChanges(task: Task, dto: UpdateTaskDto): ManagedChanges {
    const changes: ManagedChanges = {};
    for (const key of MANAGED_KEYS) {
      const value = dto[key];
      if (value !== undefined && value !== task[key])
        Object.assign(changes, { [key]: value });
    }
    return changes;
  }

  async addEvidence(
    user: AuthUser,
    id: string,
    file: UploadedFileInfo | undefined,
    note?: string,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file bằng chứng');
    const task = await this.access.findInScope(user, id);
    if (
      task.assigneeId !== user.id &&
      !(await this.access.canManage(user, task))
    ) {
      throw new ForbiddenException(
        'Bạn chỉ được tải bằng chứng cho việc của mình',
      );
    }
    const stored = await this.storage.save(file);
    const document = await this.prisma.document.create({
      data: {
        customerId: task.customerId,
        contractId: task.contractId,
        taskId: task.id,
        category: DocumentCategory.EVIDENCE,
        period: task.period,
        fileName: stored.fileName,
        storedName: stored.storedName,
        mimeType: stored.mimeType,
        size: stored.size,
        note,
        uploadedById: user.id,
      },
      select: {
        id: true,
        fileName: true,
        size: true,
        mimeType: true,
        note: true,
        createdAt: true,
        uploadedBy: { select: { id: true, fullName: true } },
      },
    });
    await this.audit.log(user.id, 'EVIDENCE', 'tasks', id, {
      documentId: document.id,
      fileName: document.fileName,
    });
    return document;
  }

  private async ensureActiveUser(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('Người làm không hợp lệ');
  }

  private async notifyAssigned(task: {
    id: string;
    title: string;
    assigneeId: string | null;
  }): Promise<void> {
    if (!task.assigneeId) return;
    const payload: TaskAssignedEvent = {
      taskId: task.id,
      assigneeId: task.assigneeId,
      title: task.title,
    };
    await this.events.emitAsync(TASK_ASSIGNED, payload);
  }
}
