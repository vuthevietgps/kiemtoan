import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TASK_ASSIGNED,
  TASK_NOTIFY,
  type TaskAssignedEvent,
  type TaskNotifyEvent,
} from '../../common/events/app-events';
import { PrismaService } from '../../core/prisma/prisma.service';

const LATEST_LIMIT = 20;

/** Thông báo trong ứng dụng (chuông trên thanh trên cùng). */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(TASK_ASSIGNED)
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: event.assigneeId,
          title: `Bạn được giao việc: ${event.title}`,
          link: `/tasks?id=${event.taskId}`,
        },
      });
    } catch (err) {
      this.logger.error('Không tạo được thông báo giao việc', err);
    }
  }

  /** 05-D: báo cho những người liên quan tới một việc (bỏ người thao tác, bỏ trùng). */
  @OnEvent(TASK_NOTIFY)
  async onTaskNotify(event: TaskNotifyEvent): Promise<void> {
    const userIds = [
      ...new Set(event.userIds.filter((id): id is string => !!id)),
    ].filter((id) => id !== event.actorId);
    if (!userIds.length) return;
    try {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          title: event.title,
          link: `/tasks?id=${event.taskId}`,
        })),
      });
    } catch (err) {
      this.logger.error('Không tạo được thông báo công việc', err);
    }
  }

  async latest(userId: string, unreadOnly = false) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, ...(unreadOnly && { readAt: null }) },
        orderBy: { createdAt: 'desc' },
        take: LATEST_LIMIT,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unreadCount };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Không tìm thấy thông báo');
    if (notification.readAt) return notification;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: result.count };
  }
}
