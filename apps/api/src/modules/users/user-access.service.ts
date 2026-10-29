import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { listPermissions } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  AccessProposalDto,
  AccessReviewDto,
  AccessRoleDto,
  AccessRequestQueryDto,
} from './dto/access.dto';
import { paginated, toSkipTake } from '../../common/types/paginated';
import {
  lockUserManagement,
  protectLastAccount,
  protectSelfAccess,
  revokeUserSessions,
} from './user-security';

/** Quyền nhạy cảm GĐ được cấp thêm cho vai trò tuỳ chỉnh ngoài quyền của vai trò nền. */
function grantableExtras(baseRole: Role): string[] {
  return [
    'finance:view',
    'reports:view_financial',
    'payments:view',
    'invoices:view',
    'client-credentials:view_secret',
    // 07 J1: GĐ có thể cấp quyền duyệt phiếu thu cho KTT (vai trò nền Quản lý).
    ...(baseRole === Role.MANAGER ? ['payments:approve'] : []),
  ];
}

@Injectable()
export class UserAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async validateProposal(
    tx: Prisma.TransactionClient,
    proposal: AccessProposalDto,
  ): Promise<void> {
    if (proposal.accessRoleId) {
      const role = await tx.accessRole.findFirst({
        where: { id: proposal.accessRoleId, deletedAt: null },
      });
      if (!role || role.baseRole !== proposal.role)
        throw new BadRequestException(
          'Vai trò tuỳ chỉnh không phù hợp vai trò nền',
        );
    }
    if (
      proposal.role === Role.ADMIN &&
      (proposal.financialAccess || proposal.secretAccess)
    )
      throw new BadRequestException(
        'Quản trị hệ thống không được kiêm quyền tài chính hoặc bí mật',
      );
  }

  async change(actor: AuthUser, id: string, proposal: AccessProposalDto) {
    return this.prisma.$transaction((tx) =>
      this.changeInTransaction(tx, actor, id, proposal),
    );
  }

  async changeInTransaction(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    id: string,
    proposal: AccessProposalDto,
  ) {
    protectSelfAccess(actor, id);
    await lockUserManagement(tx);
    const user = await tx.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    await this.validateProposal(tx, proposal);
    if (actor.role === Role.DIRECTOR) {
      await protectLastAccount(tx, user, proposal.role, user.isActive);
      await tx.user.update({ where: { id }, data: proposal });
      await revokeUserSessions(tx, id, true);
      await tx.accessRequest.updateMany({
        where: { userId: id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reason: 'Được thay thế bởi quyết định trực tiếp của giám đốc',
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'ACCESS_CHANGE',
          entity: 'users',
          entityId: id,
          detail: {
            before: {
              role: user.role,
              accessRoleId: user.accessRoleId,
              financialAccess: user.financialAccess,
              secretAccess: user.secretAccess,
            },
            after: { ...proposal },
          },
        },
      });
      return { pending: false };
    }
    if (actor.role !== Role.ADMIN)
      throw new ForbiddenException('Không có quyền đề nghị thay đổi quyền');
    if (
      await tx.accessRequest.count({
        where: { userId: id, status: 'PENDING' },
      })
    )
      throw new ConflictException(
        'Người dùng đã có yêu cầu cấp quyền chờ duyệt',
      );
    const request = await tx.accessRequest.create({
      data: {
        userId: id,
        requestedById: actor.id,
        proposal: { ...proposal },
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: 'ACCESS_REQUEST',
        entity: 'users',
        entityId: id,
        detail: { requestId: request.id, proposal: { ...proposal } },
      },
    });
    return { pending: true, requestId: request.id };
  }

  async requests(actor: AuthUser, query: AccessRequestQueryDto) {
    const where = {
      ...(actor.role === Role.DIRECTOR ? {} : { requestedById: actor.id }),
      status: query.status,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accessRequest.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, role: true },
          },
          requestedBy: { select: { fullName: true } },
          reviewedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query),
      }),
      this.prisma.accessRequest.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async review(actor: AuthUser, id: string, dto: AccessReviewDto) {
    if (actor.role !== Role.DIRECTOR)
      throw new ForbiddenException('Chỉ giám đốc được duyệt quyền');
    return this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      const found = await tx.accessRequest.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!found) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (found.status !== 'PENDING')
        throw new ConflictException('Yêu cầu đã được xử lý');
      protectSelfAccess(actor, found.userId);
      const proposal = found.proposal as unknown as AccessProposalDto;
      if (dto.approve) {
        await this.validateProposal(tx, proposal);
        await protectLastAccount(
          tx,
          found.user,
          proposal.role,
          found.user.isActive,
        );
        await tx.user.update({ where: { id: found.userId }, data: proposal });
        await revokeUserSessions(tx, found.userId, true);
      }
      await tx.accessRequest.update({
        where: { id },
        data: {
          status: dto.approve ? 'APPROVED' : 'REJECTED',
          reason: dto.reason,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: dto.approve ? 'ACCESS_APPROVE' : 'ACCESS_REJECT',
          entity: 'users',
          entityId: found.userId,
          detail: {
            requestId: id,
            reason: dto.reason,
            proposal: found.proposal,
            before: {
              role: found.user.role,
              accessRoleId: found.user.accessRoleId,
              financialAccess: found.user.financialAccess,
              secretAccess: found.user.secretAccess,
            },
          },
        },
      });
      return {
        message: dto.approve
          ? 'Đã duyệt quyền và thu hồi phiên cũ'
          : 'Đã từ chối yêu cầu',
      };
    });
  }

  roles() {
    return this.prisma.accessRole.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
  catalog() {
    return Object.values(Role).map((role) => ({
      role,
      permissions: listPermissions(role),
    }));
  }

  async saveRole(actor: AuthUser, dto: AccessRoleDto, id?: string) {
    if (actor.role !== Role.DIRECTOR)
      throw new ForbiddenException('Chỉ giám đốc được quản lý vai trò');
    const allowed = new Set([
      ...listPermissions(dto.baseRole),
      ...grantableExtras(dto.baseRole),
    ]);
    if (
      dto.permissions.some(
        (permission) =>
          !allowed.has(permission) ||
          /^(users|audit-log|settings|access-control):/.test(permission),
      )
    )
      throw new BadRequestException(
        'Vai trò nghiệp vụ chứa quyền không được phép',
      );
    const scopes =
      dto.baseRole === Role.MANAGER
        ? ['TEAM', 'OWN', 'NONE']
        : dto.baseRole === Role.CASHIER
          ? ['ALL', 'OWN', 'NONE']
          : ['OWN', 'NONE'];
    if (!scopes.includes(dto.scope))
      throw new BadRequestException('Phạm vi không được rộng hơn vai trò nền');
    return this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      const before = id
        ? await tx.accessRole.findFirst({
            where: { id, deletedAt: null },
            select: {
              name: true,
              baseRole: true,
              scope: true,
              permissions: true,
            },
          })
        : null;
      if (id && !before) throw new NotFoundException('Không tìm thấy vai trò');
      if (
        id &&
        (await tx.user.count({
          where: { accessRoleId: id, role: { not: dto.baseRole } },
        }))
      )
        throw new BadRequestException(
          'Không đổi vai trò nền khi còn người dùng thuộc vai trò này',
        );
      const data = {
        ...dto,
        name: dto.name.trim(),
        permissions: [...new Set(dto.permissions)].sort(),
      };
      const role = id
        ? await tx.accessRole.update({ where: { id }, data })
        : await tx.accessRole.create({
            data: { ...data, createdById: actor.id },
          });
      if (id) {
        const users = await tx.user.findMany({
          where: { accessRoleId: id },
          select: { id: true },
        });
        for (const user of users) await revokeUserSessions(tx, user.id, true);
      }
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: id ? 'ROLE_UPDATE' : 'ROLE_CREATE',
          entity: 'access-control',
          entityId: role.id,
          detail: { before, after: { ...data } },
        },
      });
      return role;
    });
  }
}
