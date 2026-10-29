import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DueChangeStatus, TaskStatus } from '@prisma/client';
import {
  OBLIGATION_DUES_CHANGED,
  TASK_NOTIFY,
  type ObligationDuesChangedEvent,
  type TaskNotifyEvent,
} from '../../common/events/app-events';
import { PrismaService } from '../../core/prisma/prisma.service';
import { formatBusinessDate } from '../reports/utils/period.util';

/**
 * 06 (I8): hạn nghĩa vụ đổi theo lịch/quy tắc mới → việc gắn chưa Hoàn thành đổi hạn hiện hành theo,
 * ghi dòng đổi hạn "Theo lịch pháp lý" (không phải gia hạn H7), giữ hạn gốc, báo người làm.
 */
@Injectable()
export class TaskObligationDuesListener {
  private readonly logger = new Logger(TaskObligationDuesListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent(OBLIGATION_DUES_CHANGED)
  async onDuesChanged(event: ObligationDuesChangedEvent): Promise<void> {
    for (const change of event.changes) {
      try {
        await this.apply(event, change);
      } catch (err) {
        this.logger.error(
          `Không đổi được hạn việc của nghĩa vụ ${change.obligationId}`,
          err,
        );
      }
    }
  }

  private async apply(
    event: ObligationDuesChangedEvent,
    change: ObligationDuesChangedEvent['changes'][number],
  ) {
    const tasks = await this.prisma.task.findMany({
      where: {
        obligationId: change.obligationId,
        deletedAt: null,
        status: { not: TaskStatus.COMPLETED },
      },
      select: { id: true, title: true, dueDate: true, assigneeId: true },
    });
    for (const task of tasks) {
      if (task.dueDate.getTime() === change.newDue.getTime()) continue;
      const moved = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.task.updateMany({
          where: { id: task.id, dueDate: task.dueDate },
          data: { dueDate: change.newDue },
        });
        if (!count) return false;
        const now = new Date();
        await tx.taskDueChange.create({
          data: {
            taskId: task.id,
            oldDue: task.dueDate,
            newDue: change.newDue,
            reason: event.reason,
            calendarAdjusted: true,
            status: DueChangeStatus.APPROVED,
            requestedById: event.actorId,
            requestedAt: now,
            decidedById: event.actorId,
            decidedAt: now,
          },
        });
        return true;
      });
      if (!moved) continue;
      const notify: TaskNotifyEvent = {
        userIds: [task.assigneeId],
        title: `Hạn pháp lý đổi theo lịch mới: ${task.title} — ${formatBusinessDate(task.dueDate)} → ${formatBusinessDate(change.newDue)}`,
        taskId: task.id,
        actorId: event.actorId,
      };
      await this.events.emitAsync(TASK_NOTIFY, notify);
    }
  }
}
