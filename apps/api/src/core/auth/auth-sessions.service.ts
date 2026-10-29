import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth-user.interface';
import { toAuthUser } from './auth-user.mapper';

export const tokenHash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export const REFRESH_COOKIE = 'ketoan_refresh';
export const SESSION_DAYS = 7;
export interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async create(user: AuthUser, client: ClientInfo) {
    const id = randomUUID();
    const refreshToken = `${id}.${randomBytes(32).toString('hex')}`;
    await this.prisma.authSession.create({
      data: {
        id,
        userId: user.id,
        refreshHash: tokenHash(refreshToken),
        authVersion: user.authVersion ?? 0,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
        userAgent: client.userAgent?.slice(0, 512),
        ipAddress: client.ipAddress?.slice(0, 80),
      },
    });
    return { ...(await this.access(user, id)), refreshToken };
  }

  async refresh(token: string) {
    const id = token.split('.')[0];
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    const nextToken = `${id}.${randomBytes(32).toString('hex')}`;
    const user = await this.prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { id },
        include: { user: { include: { accessRole: true } } },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date())
        return null;
      if (
        !session.user.isActive ||
        session.user.deletedAt ||
        session.user.leftAt ||
        session.authVersion !== session.user.authVersion ||
        (session.user.lockedUntil && session.user.lockedUntil > new Date())
      )
        return null;
      const changed = await tx.authSession.updateMany({
        where: { id, revokedAt: null, refreshHash: tokenHash(token) },
        data: {
          refreshHash: tokenHash(nextToken),
          previousRefreshHash: session.refreshHash,
          lastUsedAt: new Date(),
        },
      });
      if (!changed.count) {
        await tx.authSession.updateMany({
          where: { id },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      return toAuthUser(session.user);
    });
    if (!user)
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn hoặc bị thu hồi',
      );
    return { ...(await this.access(user, id)), refreshToken: nextToken };
  }

  private async access(user: AuthUser, sessionId: string) {
    return {
      accessToken: await this.jwt.signAsync(
        { sub: user.id, role: user.role, sid: sessionId },
        { expiresIn: '15m' },
      ),
      user,
      permissions: user.permissions ?? [],
    };
  }

  list(userId: string, currentId?: string) {
    return this.prisma.authSession
      .findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
        orderBy: { lastUsedAt: 'desc' },
      })
      .then((rows) =>
        rows.map((row) => ({ ...row, current: row.id === currentId })),
      );
  }
}
