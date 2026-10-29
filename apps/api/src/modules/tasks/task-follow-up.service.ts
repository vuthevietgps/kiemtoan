import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DocumentRequestStatus,
  DueChangeStatus,
  Prisma,
  Task,
  TaskStatus,
} from '@prisma/client';
import {
  TASK_NOTIFY,
  type TaskNotifyEvent,
} from '../../common/events/app-events';
import { hasPermission } from '../../core/access-control/permissions';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { lineTeam } from '../contracts/service-teams/line-team';
import {
  DueChangeRequestDto,
  DueDecisionDto,
  WaitClientDto,
} from './dto/task-follow-up.dto';
import { TaskAccess } from './task-access';
import { syncProgress } from './task-progress';
import { enterWait, leaveWait, missingFor } from './task-waits';

type Tx = Prisma.TransactionClient;

const CONFLICT =
  'Việc vừa được người khác cập nhật; tải lại để xem trạng thái mới';
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Theo dõi việc ngoài luồng soát xét (đặc tả 05-D): chờ khách tay/tiếp tục (H4), tạm dừng/tiếp tục
 * (H5), mở lại, đề nghị/duyệt gia hạn (H7, G3), xác nhận khoảng chờ (G5). Mọi lệnh ghi lịch sử và
 * nhật ký; người quản lý việc = `tasks:approve` hiệu lực hoặc Manager dòng dịch vụ (R2).
 */
@Injectable()
export class TaskFollowUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: TaskAccess,
    private readonly events: EventEmitter2,
  ) {}

  async waitClient(user: AuthUser, id: string, dto: WaitClientDto) {
    const task = await this.access.findInScope(user, id);
    if (task.assigneeId !== user.id)
      throw new ForbiddenException(
        'Chỉ người thực hiện chuyển việc sang Chờ khách',
      );
    if (
      task.status !== TaskStatus.NOT_STARTED &&
      task.status !== TaskStatus.IN_PROGRESS
    )
      throw new BadRequestException(
        'Chỉ chuyển Chờ khách cho việc Chưa bắt đầu hoặc Đang thực hiện',
      );
    if (!dto.requestId && !dto.requestName)
      throw new BadRequestException(
        'Vui lòng chọn hoặc tạo hồ sơ cần khách gửi',
      );
    const existing = dto.requestId
      ? await this.ownRequest(task, dto.requestId)
      : null;
    await this.prisma.$transaction(async (tx) => {
      const requestId =
        existing?.id ?? (await this.newRequest(tx, user, task, dto));
      await enterWait(tx, task, {
        automatic: false,
        requestId,
        note: dto.note ?? null,
        actorId: user.id,
      });
    });
    await this.audit.log(user.id, 'WAIT_CLIENT', 'tasks', id, {
      from: task.status,
      ...(dto.note && { note: dto.note }),
    });
    return this.reload(id);
  }

  async resume(user: AuthUser, id: string, note?: string) {
    const task = await this.access.findInScope(user, id);
    if (task.status !== TaskStatus.WAITING_CLIENT)
      throw new BadRequestException('Việc không ở trạng thái Chờ khách');
    if (
      task.assigneeId !== user.id &&
      !(await this.access.canManage(user, task))
    )
      throw new ForbiddenException(
        'Chỉ người thực hiện hoặc người quản lý việc tiếp tục việc',
      );
    const missing = await missingFor(this.prisma, task);
    if (missing.length)
      throw new BadRequestException(
        `Còn hồ sơ bắt buộc chưa chấp nhận: ${missing.join(', ')}`,
      );
    const to = await this.prisma.$transaction((tx) =>
      leaveWait(tx, id, user.id, note ?? 'Khách đã cung cấp hồ sơ'),
    );
    await this.audit.log(user.id, 'RESUME', 'tasks', id, { to });
    return this.reload(id);
  }

  async hold(user: AuthUser, id: string, reason: string) {
    const task = await this.managed(user, id);
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.ON_HOLD
    )
      throw new BadRequestException(
        'Không tạm dừng việc đã hoàn thành hoặc đang tạm dừng',
      );
    await this.prisma.$transaction(async (tx) => {
      // Tạm dừng không trừ hạn (H5): khoảng chờ khách đang mở được đóng lại.
      await tx.taskClientWait.updateMany({
        where: { taskId: id, endedAt: null },
        data: { endedAt: new Date() },
      });
      await this.move(tx, user, task, TaskStatus.ON_HOLD, reason, {
        statusBeforeHold: task.status,
      });
    });
    await this.log(user, task, 'HOLD', `Việc bị tạm dừng: ${task.title}`, {
      reason,
    });
    return this.reload(id);
  }

  async unhold(user: AuthUser, id: string, note?: string) {
    const task = await this.managed(user, id);
    if (task.status !== TaskStatus.ON_HOLD)
      throw new BadRequestException('Việc không ở trạng thái Tạm dừng');
    const to = task.statusBeforeHold ?? TaskStatus.NOT_STARTED;
    await this.prisma.$transaction(async (tx) => {
      if (to === TaskStatus.WAITING_CLIENT) {
        const last = await tx.taskClientWait.findFirst({
          where: { taskId: id },
          orderBy: { startedAt: 'desc' },
        });
        await tx.taskClientWait.create({
          data: {
            taskId: id,
            automatic: last?.automatic ?? true,
            fromStatus: last?.fromStatus ?? TaskStatus.NOT_STARTED,
            requestId: last?.requestId ?? null,
            note: 'Tiếp tục chờ khách sau tạm dừng',
          },
        });
      }
      await this.move(tx, user, task, to, note ?? null, {
        statusBeforeHold: null,
      });
    });
    await this.log(user, task, 'UNHOLD', `Việc được tiếp tục: ${task.title}`, {
      to,
    });
    return this.reload(id);
  }

  async reopen(user: AuthUser, id: string, reason: string) {
    const task = await this.managed(user, id);
    if (task.status !== TaskStatus.COMPLETED)
      throw new BadRequestException('Chỉ mở lại việc đã Hoàn thành');
    // Giữ mốc nộp đầu/chấp nhận cũ (G4); đếm "mở lại sau hoàn thành" cho chất lượng.
    await this.prisma.$transaction((tx) =>
      this.move(tx, user, task, TaskStatus.IN_PROGRESS, reason, {
        completedAt: null,
        reviewLevel: null,
        reopenCount: { increment: 1 },
      }),
    );
    await syncProgress(this.prisma, task);
    await this.log(user, task, 'REOPEN', `Việc được mở lại: ${task.title}`, {
      reason,
    });
    return this.reload(id);
  }

  async requestDueChange(user: AuthUser, id: string, dto: DueChangeRequestDto) {
    const task = await this.access.findInScope(user, id);
    const canManage = await this.access.canManage(user, task);
    const team = task.contractServiceId
      ? await lineTeam(this.prisma, task.contractServiceId)
      : null;
    if (task.assigneeId !== user.id && team?.leadId !== user.id && !canManage)
      throw new ForbiddenException(
        'Chỉ người thực hiện, trưởng nhóm hoặc người quản lý việc đề nghị gia hạn',
      );
    if (task.status === TaskStatus.COMPLETED)
      throw new BadRequestException('Việc đã hoàn thành, không gia hạn');
    const newDue = new Date(dto.newDue);
    if (newDue <= task.dueDate)
      throw new BadRequestException('Hạn mới phải sau hạn hiện hành');
    if (dto.documented) {
      if (!task.isStatutory)
        throw new BadRequestException(
          'Gia hạn theo văn bản chỉ dùng cho việc có hạn pháp lý',
        );
      if (!hasPermission(user, 'contracts', 'approve'))
        throw new ForbiddenException(
          'Chỉ Giám đốc ghi nhận gia hạn theo văn bản',
        );
    } else if (task.isStatutory)
      throw new BadRequestException(
        'Hạn pháp lý không gia hạn được; nếu cơ quan cho lùi hạn, Giám đốc ghi nhận gia hạn theo văn bản',
      );
    const pending = await this.prisma.taskDueChange.count({
      where: { taskId: id, status: DueChangeStatus.PENDING },
    });
    if (pending)
      throw new ConflictException('Việc đang có đề nghị gia hạn chờ duyệt');
    await this.prisma.$transaction(async (tx) => {
      await tx.taskDueChange.create({
        data: {
          taskId: id,
          oldDue: task.dueDate,
          newDue,
          reason: dto.reason,
          documented: !!dto.documented,
          requestedById: user.id,
          ...(dto.documented && {
            status: DueChangeStatus.APPROVED,
            decidedById: user.id,
            decidedAt: new Date(),
          }),
        },
      });
      if (dto.documented) await this.applyDue(tx, task, newDue);
    });
    await this.log(
      user,
      task,
      dto.documented ? 'DUE_CHANGE_DOCUMENTED' : 'DUE_CHANGE_REQUEST',
      dto.documented
        ? `Hạn pháp lý được lùi theo văn bản: ${task.title}`
        : `Đề nghị gia hạn "${task.title}" đến ${day(newDue)}`,
      { from: day(task.dueDate), to: day(newDue), reason: dto.reason },
      dto.documented ? [task.assigneeId] : [team?.managerId],
    );
    return this.reload(id);
  }

  async decideDueChange(
    user: AuthUser,
    id: string,
    changeId: string,
    dto: DueDecisionDto,
  ) {
    const task = await this.managed(user, id);
    const change = await this.prisma.taskDueChange.findFirst({
      where: { id: changeId, taskId: id },
    });
    if (!change) throw new NotFoundException('Không tìm thấy đề nghị gia hạn');
    if (change.requestedById === user.id)
      throw new ForbiddenException(
        'Không tự duyệt đề nghị gia hạn của chính mình',
      );
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.taskDueChange.updateMany({
        where: { id: changeId, status: DueChangeStatus.PENDING },
        data: {
          status: dto.approve
            ? DueChangeStatus.APPROVED
            : DueChangeStatus.REJECTED,
          decidedById: user.id,
          decidedAt: new Date(),
          decisionNote: dto.note ?? null,
        },
      });
      if (!count) throw new ConflictException('Đề nghị gia hạn đã được xử lý');
      if (dto.approve)
        await this.applyDue(tx, task, change.newDue, change.oldDue);
    });
    await this.log(
      user,
      task,
      dto.approve ? 'DUE_CHANGE_APPROVE' : 'DUE_CHANGE_REJECT',
      `${dto.approve ? 'Đã duyệt' : 'Từ chối'} gia hạn "${task.title}"`,
      { from: day(change.oldDue), to: day(change.newDue) },
      [change.requestedById],
    );
    return this.reload(id);
  }

  async confirmWait(user: AuthUser, id: string, waitId: string) {
    const task = await this.access.findInScope(user, id);
    const team = task.contractServiceId
      ? await lineTeam(this.prisma, task.contractServiceId)
      : null;
    if (team?.leadId !== user.id && !(await this.access.canManage(user, task)))
      throw new ForbiddenException(
        'Chỉ trưởng nhóm của dòng hoặc người quản lý việc xác nhận',
      );
    const wait = await this.prisma.taskClientWait.findFirst({
      where: { id: waitId, taskId: id },
    });
    if (!wait) throw new NotFoundException('Không tìm thấy khoảng chờ');
    if (!wait.endedAt)
      throw new BadRequestException('Khoảng chờ chưa kết thúc');
    const { count } = await this.prisma.taskClientWait.updateMany({
      where: { id: waitId, confirmedAt: null },
      data: { confirmedById: user.id, confirmedAt: new Date() },
    });
    if (!count) throw new ConflictException('Khoảng chờ đã được xác nhận');
    await this.audit.log(user.id, 'WAIT_CONFIRM', 'tasks', id, { waitId });
    return this.reload(id);
  }

  /** Việc trong phạm vi và người thao tác là người quản lý việc. */
  private async managed(user: AuthUser, id: string): Promise<Task> {
    const task = await this.access.findInScope(user, id);
    if (!(await this.access.canManage(user, task)))
      throw new ForbiddenException(
        'Chỉ người quản lý việc được thực hiện thao tác này',
      );
    return task;
  }

  /** Hồ sơ yêu cầu có sẵn phải cùng khách (và cùng dòng dịch vụ nếu việc có dòng), chưa chấp nhận. */
  private async ownRequest(task: Task, requestId: string) {
    const request = await this.prisma.customerDocumentRequest.findFirst({
      where: {
        id: requestId,
        customerId: task.customerId,
        ...(task.contractServiceId && {
          contractServiceId: task.contractServiceId,
        }),
      },
    });
    if (!request)
      throw new BadRequestException('Hồ sơ yêu cầu không thuộc việc này');
    if (request.status === DocumentRequestStatus.ACCEPTED)
      throw new BadRequestException('Hồ sơ này đã được chấp nhận');
    return request;
  }

  private async newRequest(
    tx: Tx,
    user: AuthUser,
    task: Task,
    dto: WaitClientDto,
  ) {
    const step = task.planStepId
      ? await tx.contractPlanStep.findUnique({
          where: { id: task.planStepId },
          select: { stepKey: true },
        })
      : null;
    const request = await tx.customerDocumentRequest.create({
      data: {
        customerId: task.customerId,
        contractId: task.contractId,
        contractServiceId: task.contractServiceId,
        taskId: task.id,
        period: task.period,
        stepKey: step?.stepKey ?? null,
        name: dto.requestName!,
        // Chờ tay: người làm tự tiếp tục khi xong; chấp nhận hồ sơ này cũng tự mở lại việc.
        required: false,
        status: DocumentRequestStatus.REQUESTED,
        requestedAt: new Date(),
        requestMethod: dto.method ?? null,
        createdById: user.id,
        events: {
          create: {
            toStatus: DocumentRequestStatus.REQUESTED,
            actorId: user.id,
            note: 'Người làm yêu cầu khi chuyển việc sang Chờ khách',
          },
        },
      },
    });
    return request.id;
  }

  private async move(
    tx: Tx,
    user: AuthUser,
    task: Task,
    to: TaskStatus,
    note: string | null,
    data: Prisma.TaskUncheckedUpdateManyInput,
  ) {
    const { count } = await tx.task.updateMany({
      where: { id: task.id, status: task.status, deletedAt: null },
      data: { ...data, status: to },
    });
    if (!count) throw new ConflictException(CONFLICT);
    await tx.taskStatusEvent.create({
      data: {
        taskId: task.id,
        fromStatus: task.status,
        toStatus: to,
        actorId: user.id,
        note,
      },
    });
  }

  /** Đổi hạn hiện hành có điều kiện (hạn gốc giữ nguyên); hạn đã đổi bởi người khác → 409. */
  private async applyDue(
    tx: Tx,
    task: Task,
    newDue: Date,
    expected: Date = task.dueDate,
  ) {
    const { count } = await tx.task.updateMany({
      where: { id: task.id, dueDate: expected, deletedAt: null },
      data: { dueDate: newDue },
    });
    if (!count)
      throw new ConflictException('Hạn của việc vừa được đổi; tải lại để xem');
  }

  private async log(
    user: AuthUser,
    task: Task,
    action: string,
    title: string,
    detail: Prisma.InputJsonObject,
    notify: (string | null | undefined)[] = [task.assigneeId],
  ) {
    await this.audit.log(user.id, action, 'tasks', task.id, detail);
    const event: TaskNotifyEvent = {
      userIds: notify,
      title,
      taskId: task.id,
      actorId: user.id,
    };
    await this.events.emitAsync(TASK_NOTIFY, event);
  }

  private reload(id: string) {
    return this.prisma.task.findUniqueOrThrow({ where: { id } });
  }
}
