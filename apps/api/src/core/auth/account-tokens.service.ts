import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthMailer } from './auth-mailer.service';
import { tokenHash } from './auth-sessions.service';
import { validatePassword } from './password-policy';

@Injectable()
export class AccountTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailer: AuthMailer,
    private readonly audit: AuditService,
  ) {}

  async issue(userId: string, purpose: 'INVITE' | 'RESET') {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, leftAt: null },
    });
    if (!user || !user.isActive)
      throw new BadRequestException('Tài khoản không thể nhận liên kết');
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + (purpose === 'INVITE' ? 24 * 60 : 30) * 60000,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`account:${userId}`}))::text`;
      await tx.userActionToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.userActionToken.create({
        data: { userId, purpose, tokenHash: tokenHash(token), expiresAt },
      });
    });
    const origin = this.config
      .get<string>(
        'APP_PUBLIC_URL',
        this.config.get<string>('CORS_ORIGIN', 'http://localhost:4200'),
      )
      .split(',')[0]
      .replace(/\/$/, '');
    const link = `${origin}/${purpose === 'INVITE' ? 'activate' : 'reset-password'}#token=${token}`;
    const emailSent = await this.mailer.send(user.email, link, purpose);
    await this.audit.log(
      null,
      purpose === 'INVITE' ? 'INVITE' : 'PASSWORD_RESET_REQUEST',
      'users',
      userId,
      { emailSent },
    );
    return { link, expiresAt, emailSent };
  }

  async consume(
    token: string,
    password: string,
    purpose: 'INVITE' | 'RESET',
  ): Promise<void> {
    validatePassword(password);
    const found = await this.prisma.userActionToken.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!found)
      throw new BadRequestException('Liên kết không hợp lệ hoặc đã hết hạn');
    const hash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`account:${found.userId}`}))::text`;
      const user = await tx.user.findUnique({ where: { id: found.userId } });
      const consumed = await tx.userActionToken.updateMany({
        where: {
          id: found.id,
          purpose,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (!consumed.count || !user?.isActive || user.deletedAt || user.leftAt)
        throw new BadRequestException('Liên kết không hợp lệ hoặc đã hết hạn');
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hash,
          mustChangePassword: false,
          activatedAt: user.activatedAt ?? new Date(),
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
          action: purpose === 'INVITE' ? 'ACTIVATE' : 'PASSWORD_RESET',
          entity: 'auth',
          entityId: user.id,
        },
      });
    });
  }
}
