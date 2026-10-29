import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TASK_NOTIFY,
  type TaskNotifyEvent,
} from '../../common/events/app-events';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TaskAccess } from './task-access';

/**
 * Bình luận trên việc (đặc tả 05-E, H11): ai xem được việc thì bình luận được; chỉ thêm, không sửa/xoá,
 * không @nhắc tên. Báo người làm, người kiểm tra, người phê duyệt (trừ người viết).
 */
@Injectable()
export class TaskCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TaskAccess,
    private readonly events: EventEmitter2,
  ) {}

  async add(user: AuthUser, id: string, content: string) {
    const task = await this.access.findInScope(user, id);
    const comment = await this.prisma.taskComment.create({
      data: { taskId: id, authorId: user.id, content: content.trim() },
    });
    const event: TaskNotifyEvent = {
      userIds: [task.assigneeId, task.reviewerId, task.approverId],
      title: `${user.fullName} bình luận "${task.title}": ${content.trim().slice(0, 80)}`,
      taskId: id,
      actorId: user.id,
    };
    await this.events.emitAsync(TASK_NOTIFY, event);
    return {
      ...comment,
      author: { id: user.id, fullName: user.fullName },
    };
  }
}
