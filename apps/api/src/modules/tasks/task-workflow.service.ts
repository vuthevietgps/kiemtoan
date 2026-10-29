import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, Task, TaskReviewDecision, TaskStatus } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TASK_NOTIFY,
  TASK_OBLIGATION_PROGRESS,
  type TaskNotifyEvent,
  type TaskObligationProgressEvent,
} from '../../common/events/app-events';
import { TaskAccess } from './task-access';
import { loadUnmetPrerequisites } from './task-dependencies';
import { missingFor } from './task-waits';
import { EVIDENCE_DOC_WHERE } from './task-filters';
import { syncProgress } from './task-progress';
import {
  applyAction,
  isWorkflowError,
  WorkflowAction,
} from './task-status.rules';

const CONFLICT =
  'Việc vừa được người khác cập nhật (chuyển cấp hoặc trạng thái); tải lại để xem';

/**
 * Luồng làm → gửi kiểm tra → soát xét 1/2 cấp → phê duyệt → giao nộp (đặc tả 05-B). Mỗi lệnh ghi
 * lịch sử trạng thái (PL1 VI.5), lượt soát xét (G7) và đổi có điều kiện để bấm đồng thời → 409.
 */
@Injectable()
export class TaskWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: TaskAccess,
    private readonly events: EventEmitter2,
  ) {}

  start(user: AuthUser, id: string) {
    return this.act(user, id, 'START');
  }

  submit(user: AuthUser, id: string) {
    return this.act(user, id, 'SUBMIT');
  }

  complete(user: AuthUser, id: string, note?: string) {
    return this.act(user, id, 'COMPLETE', note);
  }

  review(
    user: AuthUser,
    id: string,
    decision: TaskReviewDecision,
    note?: string,
  ) {
    return this.act(
      user,
      id,
      decision === TaskReviewDecision.ACCEPT ? 'ACCEPT' : 'RETURN',
      note,
    );
  }

  deliver(user: AuthUser, id: string, note?: string) {
    return this.act(user, id, 'DELIVER', note);
  }

  private async act(
    user: AuthUser,
    id: string,
    action: WorkflowAction,
    note?: string,
  ) {
    const task = await this.access.findInScope(user, id);
    const isReview = action === 'ACCEPT' || action === 'RETURN';
    const [canManage, acceptedEarlierLevel, evidenceCount, unmet, missing] =
      await Promise.all([
        this.access.canManage(user, task),
        isReview ? this.acceptedEarlierLevel(task, user.id) : false,
        this.evidenceCount(task, action),
        action === 'START'
          ? loadUnmetPrerequisites(this.prisma, [task])
          : new Map<string, string[]>(),
        action === 'START' ? missingFor(this.prisma, task) : [],
      ]);
    const now = new Date();
    const result = applyAction(
      action,
      task,
      { id: user.id, canManage, acceptedEarlierLevel },
      {
        evidenceCount,
        note,
        now,
        waitingFor: unmet.get(task.id),
        missingDocuments: missing,
      },
    );
    if (isWorkflowError(result)) {
      if (result.kind === 'forbidden')
        throw new ForbiddenException(result.message);
      throw new BadRequestException(result.message);
    }
    const enteredAt = isReview ? await this.levelEnteredAt(task) : null;
    const trimmed = note?.trim() || null;
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.task.updateMany({
        where: {
          id,
          deletedAt: null,
          status: task.status,
          reviewLevel: task.reviewLevel,
        },
        data: result.data,
      });
      if (!count) throw new ConflictException(CONFLICT);
      await tx.taskStatusEvent.create({
        data: {
          taskId: id,
          fromStatus: task.status,
          toStatus: result.to,
          actorId: user.id,
          note: this.eventNote(action, task, trimmed),
          occurredAt: now,
        },
      });
      if (isReview)
        await tx.taskReview.create({
          data: {
            taskId: id,
            level: task.reviewLevel!,
            reviewerId: user.id,
            decision:
              action === 'ACCEPT'
                ? TaskReviewDecision.ACCEPT
                : TaskReviewDecision.RETURN,
            note: trimmed,
            enteredAt: enteredAt ?? now,
            decidedAt: now,
          },
        });
    });
    await this.audit.log(user.id, action, 'tasks', id, {
      from: task.status,
      to: result.to,
      ...(task.reviewLevel && { level: task.reviewLevel }),
      ...(trimmed && { note: trimmed }),
    } satisfies Prisma.InputJsonObject);
    if (task.status !== result.to) await syncProgress(this.prisma, task);
    const updated = await this.prisma.task.findUniqueOrThrow({ where: { id } });
    if (updated.obligationId && task.status !== updated.status) {
      // 06 (I6): lịch báo cáo theo việc gắn — bắt đầu → Đang chuẩn bị, Hoàn thành → Đã nộp.
      const event: TaskObligationProgressEvent = {
        obligationId: updated.obligationId,
        taskId: id,
        status: updated.status,
        actorId: user.id,
      };
      await this.events.emitAsync(TASK_OBLIGATION_PROGRESS, event);
    }
    await this.notify(user, action, task, updated.status, trimmed);
    return updated;
  }

  /** 05-D: báo người cần xử lý tiếp — người kiểm tra/phê duyệt khi đến lượt, người làm khi xong/trả lại. */
  private async notify(
    user: AuthUser,
    action: WorkflowAction,
    task: Task,
    to: TaskStatus,
    note: string | null,
  ) {
    const send = (userId: string | null, title: string) => {
      const event: TaskNotifyEvent = {
        userIds: [userId],
        title,
        taskId: task.id,
        actorId: user.id,
      };
      return this.events.emitAsync(TASK_NOTIFY, event);
    };
    const level = action === 'SUBMIT' ? 1 : (task.reviewLevel ?? 0) + 1;
    if (
      to === TaskStatus.IN_REVIEW &&
      (action === 'SUBMIT' || action === 'ACCEPT')
    )
      await send(
        level === 1 ? task.reviewerId : task.approverId,
        level === 1
          ? `Việc chờ bạn kiểm tra: ${task.title}`
          : `Việc chờ bạn phê duyệt: ${task.title}`,
      );
    else if (action === 'RETURN')
      await send(
        task.assigneeId,
        `Việc bị trả lại: ${task.title}${note ? ` — ${note}` : ''}`,
      );
    else if (action === 'ACCEPT')
      await send(
        task.assigneeId,
        to === TaskStatus.APPROVED
          ? `Việc đã được phê duyệt, cần xác nhận giao nộp: ${task.title}`
          : `Việc đã được phê duyệt và hoàn thành: ${task.title}`,
      );
  }

  /** Bằng chứng hiện có; giao nộp chỉ tính file tải sau khi phê duyệt (kết quả giao nộp — H1). */
  private evidenceCount(task: Task, action: WorkflowAction) {
    return this.prisma.document.count({
      where: {
        ...EVIDENCE_DOC_WHERE,
        taskId: task.id,
        ...(action === 'DELIVER' &&
          task.approvedAt && { createdAt: { gte: task.approvedAt } }),
      },
    });
  }

  /** H3: người đã chấp nhận cấp 1 của lượt này không được xử lý tiếp cấp 2. */
  private async acceptedEarlierLevel(task: Task, userId: string) {
    if (task.status !== TaskStatus.IN_REVIEW || (task.reviewLevel ?? 0) < 2)
      return false;
    const last = await this.prisma.taskReview.findFirst({
      where: { taskId: task.id, level: task.reviewLevel! - 1 },
      orderBy: { decidedAt: 'desc' },
      select: { reviewerId: true, decision: true },
    });
    return (
      last?.decision === TaskReviewDecision.ACCEPT && last.reviewerId === userId
    );
  }

  /** Lúc việc vào cấp hiện tại = lần chuyển trạng thái gần nhất (gửi kiểm tra hoặc lên cấp). */
  private async levelEnteredAt(task: Task): Promise<Date | null> {
    const last = await this.prisma.taskStatusEvent.findFirst({
      where: { taskId: task.id },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    });
    return last?.occurredAt ?? null;
  }

  private eventNote(
    action: WorkflowAction,
    task: Task,
    note: string | null,
  ): string | null {
    if (action === 'ACCEPT' && task.reviewLevel! < task.reviewLevels)
      return `Chấp nhận cấp ${task.reviewLevel}, chuyển cấp ${task.reviewLevel! + 1}`;
    return note;
  }
}
