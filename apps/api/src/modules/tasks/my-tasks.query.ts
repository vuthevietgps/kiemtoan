import { Injectable } from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { MY_TABS, MyTab, MyTasksQueryDto } from './dto/task.dto';
import { loadUrgencyConfig, urgencyRank } from '../deadlines/urgency';
import { loadWorkingCalendar } from '../deadlines/working-calendar.loader';
import { REVIEW_SLA_WORKING_DAYS, workingDaysWaited } from './review-sla';
import { loadUnmetPrerequisites } from './task-dependencies';
import {
  baseTaskWhere,
  myTabWhere,
  TASK_LIST_INCLUDE,
  toTaskRow,
} from './task-filters';

/**
 * Việc của tôi (4 tab) và hàng đợi "Chờ tôi kiểm tra / phê duyệt" (đặc tả 05-E, H11). Hàng đợi
 * kèm số ngày làm việc đã chờ ở cấp hiện tại và cờ quá SLA (G7).
 */
const PRIORITY_RANK: Record<TaskPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

@Injectable()
export class MyTasksQuery {
  constructor(private readonly prisma: PrismaService) {}

  async my(user: AuthUser, query: MyTasksQueryDto) {
    const tab: MyTab = query.tab ?? 'today';
    const base = baseTaskWhere(user, true);
    const where = { AND: [...base, myTabWhere(tab)] };
    const [items, total, ...counts] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: TASK_LIST_INCLUDE,
        orderBy:
          tab === 'done'
            ? [{ completedAt: { sort: 'desc', nulls: 'last' } }]
            : [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.task.count({ where }),
      ...MY_TABS.map((t) =>
        this.prisma.task.count({ where: { AND: [...base, myTabWhere(t)] } }),
      ),
    ]);
    const now = new Date();
    const [unmet, urgency] = await Promise.all([
      loadUnmetPrerequisites(
        this.prisma,
        items.filter((t) => t.status === TaskStatus.NOT_STARTED),
      ),
      loadUrgencyConfig(this.prisma),
    ]);
    const rows = items.map((t) => toTaskRow(t, now, unmet.get(t.id), urgency));
    // I11: trong trang, gấp nhất trước rồi ưu tiên cao trước (tab Đã hoàn thành giữ theo ngày xong).
    if (tab !== 'done')
      rows.sort(
        (a, b) =>
          urgencyRank(a.urgency) - urgencyRank(b.urgency) ||
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      );
    return {
      ...paginated(rows, total, query),
      counts: Object.fromEntries(MY_TABS.map((t, i) => [t, counts[i]])),
    };
  }

  /** Việc đang Chờ kiểm tra mà tôi là người được chỉ định ở cấp hiện tại; lâu nhất trước. */
  async reviewQueue(user: AuthUser) {
    const items = await this.prisma.task.findMany({
      where: {
        AND: [
          ...baseTaskWhere(user),
          { status: TaskStatus.IN_REVIEW },
          {
            OR: [
              { reviewLevel: 1, reviewerId: user.id },
              { reviewLevel: 2, approverId: user.id },
            ],
          },
        ],
      },
      include: TASK_LIST_INCLUDE,
      take: 500,
    });
    const entered = await this.enteredAt(items.map((t) => t.id));
    const [calendar, urgency] = await Promise.all([
      loadWorkingCalendar(this.prisma),
      loadUrgencyConfig(this.prisma),
    ]);
    const now = new Date();
    return items
      .map((t) => {
        const since = entered.get(t.id) ?? t.updatedAt;
        const waitingDays = workingDaysWaited(since, now, calendar);
        return {
          ...toTaskRow(t, now, [], urgency),
          levelEnteredAt: since,
          waitingDays,
          overSla: waitingDays > REVIEW_SLA_WORKING_DAYS,
        };
      })
      .sort((a, b) => a.levelEnteredAt.getTime() - b.levelEnteredAt.getTime());
  }

  /** Lúc vào cấp hiện tại = lần chuyển trạng thái gần nhất (gửi kiểm tra hoặc lên cấp). */
  private async enteredAt(taskIds: string[]) {
    if (!taskIds.length) return new Map<string, Date>();
    const rows = await this.prisma.taskStatusEvent.groupBy({
      by: ['taskId'],
      where: {
        taskId: { in: taskIds },
      } satisfies Prisma.TaskStatusEventWhereInput,
      _max: { occurredAt: true },
    });
    return new Map(rows.map((r) => [r.taskId, r._max.occurredAt!]));
  }
}
