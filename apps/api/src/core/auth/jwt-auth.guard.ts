import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, JwtPayload } from './auth-user.interface';
import { IS_PUBLIC_KEY } from './decorators/auth.decorators';
import { toAuthUser } from './auth-user.mapper';

/** Guard toàn cục: mọi endpoint cần đăng nhập, trừ endpoint đánh dấu @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Bạn chưa đăng nhập');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    if (!payload.sid) throw new UnauthorizedException('Vui lòng đăng nhập lại');
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: { accessRole: true } } },
    });
    const user = session?.user;
    if (
      !session ||
      !user?.isActive ||
      user.deletedAt ||
      user.leftAt ||
      session.authVersion !== user.authVersion ||
      (user.lockedUntil && user.lockedUntil > new Date())
    )
      throw new UnauthorizedException(
        'Phiên đăng nhập đã bị thu hồi hoặc tài khoản bị khoá',
      );
    const relative = request.path.replace(/^\/api\/v1\//, '');
    if (
      user.mustChangePassword &&
      !/^auth\/(me|profile|change-password|sessions)(\/|$)/.test(relative)
    ) {
      throw new UnauthorizedException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Vui lòng đổi mật khẩu ban đầu trước khi sử dụng',
      });
    }
    request.user = {
      ...toAuthUser(user),
      sessionId: session.id,
      secretVerifiedAt: session.secretVerifiedAt,
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) return token;
    // Cho phép tải file qua link trực tiếp: ?token=...
    if (
      !/\/documents\/[^/]+\/download$/.test(request.path) &&
      !(/\/reports\//.test(request.path) && request.query['format'] === 'csv')
    )
      return undefined;
    const queryToken = request.query['token'];
    return typeof queryToken === 'string' ? queryToken : undefined;
  }
}
