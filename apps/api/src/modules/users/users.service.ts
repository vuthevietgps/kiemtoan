import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { paginated, toSkipTake } from '../../common/types/paginated';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { validatePassword } from '../../core/auth/password-policy';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';
import { UserAccessService } from './user-access.service';
import { PublicUser, USER_PUBLIC_SELECT } from './user-select';
import {
  lockUserManagement,
  protectLastAccount,
  revokeUserSessions,
  userScope,
} from './user-security';
export { USER_PUBLIC_SELECT } from './user-select';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: UserAccessService,
  ) {}

  async findAll(query: UserQueryDto, actor: AuthUser) {
    const state: Prisma.UserWhereInput =
      query.status === 'LEFT'
        ? { leftAt: { not: null } }
        : query.status === 'LOCKED'
          ? { isActive: false, leftAt: null }
          : query.status === 'INVITED'
            ? {
                activatedAt: null,
                mustChangePassword: true,
                isActive: true,
                leftAt: null,
              }
            : query.status === 'ACTIVE'
              ? {
                  isActive: true,
                  leftAt: null,
                  NOT: { activatedAt: null, mustChangePassword: true },
                }
              : {};
    const where: Prisma.UserWhereInput = {
      AND: [
        { deletedAt: null, role: query.role, teamId: query.teamId },
        userScope(actor),
        state,
        ...(query.search
          ? [
              {
                OR: [
                  {
                    fullName: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    email: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_PUBLIC_SELECT,
        orderBy: { fullName: 'asc' },
        ...toSkipTake(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  options(actor: AuthUser) {
    return this.prisma.user.findMany({
      where: {
        AND: [
          { deletedAt: null, isActive: true, leftAt: null },
          userScope(actor),
        ],
      },
      select: { id: true, fullName: true, role: true, teamId: true },
      orderBy: { fullName: 'asc' },
    });
  }
  teams(actor: AuthUser) {
    return this.prisma.team.findMany({
      where:
        actor.role === Role.DIRECTOR || actor.role === Role.ADMIN
          ? {}
          : { id: actor.teamId ?? '00000000-0000-0000-0000-000000000000' },
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    });
  }
  async findOne(id: string, actor?: AuthUser): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { AND: [{ id, deletedAt: null }, actor ? userScope(actor) : {}] },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  async create(dto: CreateUserDto, actor?: AuthUser): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException('Email đã được sử dụng');
    if (dto.password) validatePassword(dto.password);
    if (
      dto.teamId &&
      !(await this.prisma.team.count({ where: { id: dto.teamId } }))
    )
      throw new BadRequestException('Nhóm không tồn tại');
    const {
      password,
      accessRoleId,
      financialAccess,
      secretAccess,
      role,
      ...profile
    } = dto;
    const direct = !actor || actor.role === Role.DIRECTOR;
    const passwordHash = await bcrypt.hash(
      password ?? randomBytes(48).toString('hex'),
      12,
    );
    return this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      await this.access.validateProposal(tx, {
        role,
        accessRoleId,
        financialAccess,
        secretAccess,
      });
      const user = await tx.user.create({
        data: {
          ...profile,
          email,
          role: direct ? role : Role.STAFF,
          accessRoleId: direct ? accessRoleId : null,
          financialAccess: direct ? financialAccess : null,
          secretAccess: direct ? secretAccess : null,
          passwordHash,
          mustChangePassword: true,
          activatedAt: null,
        },
        select: USER_PUBLIC_SELECT,
      });
      if (
        !direct &&
        (role !== Role.STAFF ||
          accessRoleId ||
          financialAccess != null ||
          secretAccess != null)
      ) {
        await this.access.changeInTransaction(tx, actor, user.id, {
          role,
          accessRoleId,
          financialAccess,
          secretAccess,
        });
        return tx.user.findUniqueOrThrow({
          where: { id: user.id },
          select: USER_PUBLIC_SELECT,
        });
      }
      return user;
    });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthUser,
  ): Promise<PublicUser> {
    const before = await this.findOne(id, actor);
    await this.validateUpdate(dto, actor);
    const {
      password,
      role,
      accessRoleId,
      financialAccess,
      secretAccess,
      ...profile
    } = dto;
    const changedAccess =
      (role !== undefined && role !== before.role) ||
      (accessRoleId !== undefined && accessRoleId !== before.accessRoleId) ||
      (financialAccess !== undefined &&
        financialAccess !== before.financialAccess) ||
      (secretAccess !== undefined && secretAccess !== before.secretAccess);
    await this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      if (changedAccess)
        await this.access.changeInTransaction(tx, actor, id, {
          role: role ?? before.role,
          accessRoleId:
            accessRoleId === undefined ? before.accessRoleId : accessRoleId,
          financialAccess:
            financialAccess === undefined
              ? before.financialAccess
              : financialAccess,
          secretAccess:
            secretAccess === undefined ? before.secretAccess : secretAccess,
        });
      await tx.user.update({
        where: { id },
        data: {
          ...profile,
          ...(password
            ? {
                passwordHash: await bcrypt.hash(password, 12),
                mustChangePassword: true,
              }
            : {}),
        },
      });
      if (
        password ||
        (dto.teamId !== undefined && dto.teamId !== before.teamId)
      ) {
        await revokeUserSessions(tx, id);
        await tx.userActionToken.updateMany({
          where: { userId: id, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'USER_UPDATE',
          entity: 'users',
          entityId: id,
          detail: {
            before: {
              fullName: before.fullName,
              teamId: before.teamId,
              phone: before.phone,
              title: before.title,
            },
            after: { ...profile },
            passwordReset: !!password,
          },
        },
      });
    });
    return this.findOne(id, actor);
  }

  private async validateUpdate(
    dto: UpdateUserDto,
    actor: AuthUser,
  ): Promise<void> {
    if (dto.password && actor.role !== Role.DIRECTOR)
      throw new ForbiddenException(
        'Dùng chức năng gửi liên kết đặt lại mật khẩu; không đặt mật khẩu thay người dùng',
      );
    if (dto.password) validatePassword(dto.password);
    if (
      dto.teamId &&
      !(await this.prisma.team.count({ where: { id: dto.teamId } }))
    )
      throw new BadRequestException('Nhóm không tồn tại');
  }

  async setActive(
    id: string,
    isActive: boolean,
    currentUserId: string,
    actor?: AuthUser,
    left = false,
  ): Promise<PublicUser> {
    if (id === currentUserId && !isActive)
      throw new BadRequestException('Không thể tự khoá tài khoản của mình');
    return this.prisma.$transaction(async (tx) => {
      await lockUserManagement(tx);
      const user = await tx.user.findFirst({ where: { id, deletedAt: null } });
      if (!user) throw new NotFoundException('Không tìm thấy người dùng');
      if (user.role === Role.DIRECTOR && actor?.role !== Role.DIRECTOR)
        throw new ForbiddenException('Chỉ giám đốc khác được khoá giám đốc');
      if (user.leftAt && isActive)
        throw new BadRequestException(
          'Tài khoản đã nghỉ việc; không mở khoá trực tiếp',
        );
      await protectLastAccount(tx, user, user.role, isActive);
      await tx.user.update({
        where: { id },
        data: {
          isActive,
          lockedUntil: null,
          failedLoginCount: 0,
          ...(left ? { leftAt: new Date() } : {}),
        },
      });
      await revokeUserSessions(tx, id);
      await tx.userActionToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          action: left ? 'USER_LEFT' : isActive ? 'USER_UNLOCK' : 'USER_LOCK',
          entity: 'users',
          entityId: id,
          detail: { before: user.isActive, after: isActive },
        },
      });
      return tx.user.findUniqueOrThrow({
        where: { id },
        select: USER_PUBLIC_SELECT,
      });
    });
  }
}
