import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth-user.interface';
import { toAuthUser } from './auth-user.mapper';
import { AuthSessionsService, ClientInfo } from './auth-sessions.service';
import { AccountTokensService } from './account-tokens.service';
import { LoginDto } from './dto/login.dto';
import { validatePassword } from './password-policy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: AuthSessionsService,
    private readonly tokens: AccountTokensService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, client: ClientInfo = {}) {
    const email = dto.email.trim().toLowerCase();
    const identity = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`account:${identity?.id ?? email}`}))::text`;
      const found = await tx.user.findFirst({
        where: { email, deletedAt: null },
        include: { accessRole: true },
      });
      if (
        !found ||
        !found.isActive ||
        found.leftAt ||
        (found.lockedUntil && found.lockedUntil > new Date())
      )
        return null;
      if (!(await bcrypt.compare(dto.password, found.passwordHash))) {
        const failures = found.lockedUntil ? 1 : found.failedLoginCount + 1;
        await tx.user.update({
          where: { id: found.id },
          data: {
            failedLoginCount: failures,
            lockedUntil:
              failures >= 5 ? new Date(Date.now() + 15 * 60000) : null,
          },
        });
        return null;
      }
      await tx.user.update({
        where: { id: found.id },
        data: {
          lastLoginAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      return found;
    });
    if (!user) {
      await this.audit.log(null, 'LOGIN_FAILED', 'auth', null, {
        ipAddress: client.ipAddress ?? null,
      });
      throw new UnauthorizedException(
        'Email hoặc mật khẩu không đúng, hoặc tài khoản tạm thời không thể đăng nhập',
      );
    }
    await this.audit.log(user.id, 'LOGIN', 'auth', user.id);
    return this.sessions.create(toAuthUser(user), client);
  }

  session(user: AuthUser) {
    return { user, permissions: user.permissions ?? [] };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const found = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
        isActive: true,
        leftAt: null,
      },
    });
    if (found) {
      const recent = await this.prisma.userActionToken.count({
        where: {
          userId: found.id,
          createdAt: { gt: new Date(Date.now() - 60000) },
        },
      });
      if (!recent) await this.tokens.issue(found.id, 'RESET');
    }
    return {
      message:
        'Nếu tài khoản phù hợp, hướng dẫn đặt lại mật khẩu sẽ được gửi qua email. Nếu chưa nhận được, hãy liên hệ quản trị.',
    };
  }

  async changePassword(
    user: AuthUser,
    currentPassword: string,
    password: string,
  ): Promise<void> {
    validatePassword(password);
    if (!(await this.checkCurrentPassword(user.id, currentPassword)))
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`account:${user.id}`}))::text`;
      const found = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (!(await bcrypt.compare(currentPassword, found.passwordHash)))
        throw new BadRequestException('Mật khẩu hiện tại không đúng');
      if (await bcrypt.compare(password, found.passwordHash))
        throw new BadRequestException(
          'Mật khẩu mới phải khác mật khẩu hiện tại',
        );
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(password, 12),
          mustChangePassword: false,
          activatedAt: found.activatedAt ?? new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          authVersion: { increment: 1 },
        },
      });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.userActionToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_CHANGE',
          entity: 'auth',
          entityId: user.id,
        },
      });
    });
  }

  async verifyPassword(user: AuthUser, password: string): Promise<void> {
    if (!(await this.checkCurrentPassword(user.id, password)))
      throw new UnauthorizedException('Mật khẩu không đúng');
    await this.prisma.authSession.update({
      where: { id: user.sessionId },
      data: { secretVerifiedAt: new Date() },
    });
    await this.audit.log(user.id, 'VERIFY_PASSWORD', 'auth', user.sessionId);
  }

  private async checkCurrentPassword(
    id: string,
    password: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`account:${id}`}))::text`;
      const user = await tx.user.findUniqueOrThrow({ where: { id } });
      if (!user.isActive || (user.lockedUntil && user.lockedUntil > new Date()))
        return false;
      if (await bcrypt.compare(password, user.passwordHash)) {
        await tx.user.update({
          where: { id },
          data: { failedLoginCount: 0, lockedUntil: null },
        });
        return true;
      }
      const failures = user.failedLoginCount + 1;
      await tx.user.update({
        where: { id },
        data: {
          failedLoginCount: failures,
          ...(failures >= 5
            ? { lockedUntil: new Date(Date.now() + 15 * 60000) }
            : {}),
        },
      });
      if (failures >= 5)
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await tx.auditLog.create({
        data: {
          userId: id,
          action: 'PASSWORD_VERIFY_FAILED',
          entity: 'auth',
          entityId: id,
        },
      });
      return false;
    });
  }
}
