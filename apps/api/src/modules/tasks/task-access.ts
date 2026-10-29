import { Injectable, NotFoundException } from '@nestjs/common';
import { Task } from '@prisma/client';
import { hasPermission } from '../../core/access-control/permissions';
import { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { lineTeam } from '../contracts/service-teams/line-team';
import { baseTaskWhere } from './task-filters';

/**
 * Phạm vi và vai trên một việc (đặc tả 05, sửa R2): mọi kiểm tra dùng quyền hiệu lực của người
 * dùng (gồm vai trò tùy chỉnh), không dùng vai trò gốc.
 */
@Injectable()
export class TaskAccess {
  constructor(private readonly prisma: PrismaService) {}

  /** Việc ngoài phạm vi → 404 (không lộ là có tồn tại). */
  async findInScope(user: AuthUser, id: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { AND: [...baseTaskWhere(user), { id }] },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    return task;
  }

  /**
   * Người quản lý việc: `tasks:approve` hiệu lực (việc đã trong phạm vi) hoặc Manager của nhóm
   * dòng dịch vụ (G1, H8 — dòng kiểm toán lấy nhóm 04-F).
   */
  async canManage(
    user: AuthUser,
    task: Pick<Task, 'contractServiceId'>,
  ): Promise<boolean> {
    if (hasPermission(user, 'tasks', 'approve')) return true;
    if (!task.contractServiceId) return false;
    const team = await lineTeam(this.prisma, task.contractServiceId);
    return !!team && team.managerId === user.id;
  }
}
