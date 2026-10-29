import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  ServiceUnavailableException,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { AccountTokensService } from '../../core/auth/account-tokens.service';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { effectivePermissions } from '../../core/access-control/permissions';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import {
  AccessProposalDto,
  AccessReviewDto,
  AccessRoleDto,
  TeamDto,
  AccessRequestQueryDto,
} from './dto/access.dto';
import { UserAccessService } from './user-access.service';
import { UsersService } from './users.service';
import { lockUserManagement } from './user-security';

@ApiTags('user-management')
@ApiBearerAuth()
@Controller('users')
export class UserManagementController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly access: UserAccessService,
    private readonly tokens: AccountTokensService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Get('permission-catalog')
  @RequirePermission('access-control', 'view')
  catalog() {
    return this.access.catalog();
  }

  @Get('access-roles')
  @RequirePermission('access-control', 'view')
  roles() {
    return this.access.roles();
  }
  @Post('access-roles')
  @RequirePermission('access-control', 'create')
  createRole(@CurrentUser() actor: AuthUser, @Body() dto: AccessRoleDto) {
    return this.access.saveRole(actor, dto);
  }
  @Patch('access-roles/:id')
  @RequirePermission('access-control', 'update')
  updateRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AccessRoleDto,
  ) {
    return this.access.saveRole(actor, dto, id);
  }
  @Delete('access-roles/:id')
  @RequirePermission('access-control', 'delete')
  async deleteRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      if (await tx.user.count({ where: { accessRoleId: id } }))
        throw new BadRequestException('Vai trò còn người dùng, không thể xoá');
      await tx.accessRole.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'ROLE_DELETE',
          entity: 'access-control',
          entityId: id,
        },
      });
      return { message: 'Đã xoá vai trò' };
    });
  }
  @Get('access-requests')
  @RequirePermission('users', 'manage_access')
  requests(
    @CurrentUser() actor: AuthUser,
    @Query() query: AccessRequestQueryDto,
  ) {
    return this.access.requests(actor, query);
  }
  @Post(':id/access-requests')
  @RequirePermission('users', 'manage_access')
  propose(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AccessProposalDto,
  ) {
    return this.access.change(actor, id, dto);
  }
  @Post('access-requests/:id/review')
  @RequirePermission('users', 'approve')
  review(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AccessReviewDto,
  ) {
    return this.access.review(actor, id, dto);
  }

  @Post('teams')
  @RequirePermission('users', 'create')
  async createTeam(@Body() dto: TeamDto) {
    const name = dto.name.trim();
    return this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      if (
        await tx.team.count({
          where: { name: { equals: name, mode: 'insensitive' } },
        })
      )
        throw new BadRequestException('Tên nhóm đã tồn tại');
      return tx.team.create({ data: { name } });
    });
  }
  @Patch('teams/:id')
  @RequirePermission('users', 'update')
  updateTeam(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      const name = dto.name.trim();
      if (
        await tx.team.count({
          where: {
            id: { not: id },
            name: { equals: name, mode: 'insensitive' },
          },
        })
      )
        throw new BadRequestException('Tên nhóm đã tồn tại');
      return tx.team.update({ where: { id }, data: { name } });
    });
  }
  @Delete('teams/:id')
  @RequirePermission('users', 'update')
  async deleteTeam(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      if (await tx.user.count({ where: { teamId: id } }))
        throw new BadRequestException('Nhóm còn thành viên, không thể xoá');
      await tx.team.delete({ where: { id } });
      return { message: 'Đã xoá nhóm' };
    });
  }
  @Post(':id/invite')
  @RequirePermission('users', 'update')
  invite(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliverLink(actor, id, 'INVITE');
  }
  @Post(':id/password-reset')
  @RequirePermission('users', 'update')
  reset(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliverLink(actor, id, 'RESET');
  }
  @Post(':id/revoke-sessions')
  @RequirePermission('users', 'update')
  async revoke(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const target = await this.users.findOne(id, actor);
    if (target.role === Role.DIRECTOR && actor.role !== Role.DIRECTOR)
      throw new ForbiddenException(
        'Chỉ giám đốc được thu hồi phiên của giám đốc khác',
      );
    await this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      await tx.user.update({
        where: { id },
        data: { authVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    await this.audit.log(actor.id, 'REVOKE_USER_SESSIONS', 'users', id);
    return { message: 'Đã thu hồi toàn bộ phiên của người dùng' };
  }
  @Post(':id/leave')
  @RequirePermission('users', 'update')
  leave(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.setActive(id, false, actor.id, actor, true);
  }

  private async deliverLink(
    actor: AuthUser,
    id: string,
    purpose: 'INVITE' | 'RESET',
  ) {
    const target = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { accessRole: true },
    });
    if (purpose === 'INVITE' && !target.mustChangePassword)
      throw new BadRequestException(
        'Tài khoản đã kích hoạt; dùng đặt lại mật khẩu',
      );
    const permissions = effectivePermissions(target);
    const sensitive =
      target.role === Role.ADMIN ||
      target.role === Role.DIRECTOR ||
      permissions.includes('finance:view') ||
      permissions.includes('client-credentials:view_secret');
    if (target.role === Role.DIRECTOR && actor.role !== Role.DIRECTOR)
      throw new ForbiddenException(
        'Chỉ giám đốc được yêu cầu khôi phục tài khoản giám đốc',
      );
    if (
      actor.role !== Role.DIRECTOR &&
      sensitive &&
      !this.config.get<string>('SMTP_HOST')
    )
      throw new ServiceUnavailableException(
        'Cần cấu hình SMTP để gửi liên kết cho tài khoản đặc quyền; quản trị không được nhận liên kết thay người dùng',
      );
    const result = await this.tokens.issue(id, purpose);
    if (actor.role !== Role.DIRECTOR && sensitive) {
      if (!result.emailSent)
        throw new ServiceUnavailableException(
          'Cần cấu hình SMTP để gửi liên kết cho tài khoản đặc quyền; quản trị không được nhận liên kết thay người dùng',
        );
      return { emailSent: true, expiresAt: result.expiresAt };
    }
    return result;
  }
}
