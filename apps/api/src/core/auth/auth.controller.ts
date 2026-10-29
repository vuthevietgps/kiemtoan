import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthUser } from './auth-user.interface';
import { AuthService } from './auth.service';
import {
  AuthSessionsService,
  REFRESH_COOKIE,
  SESSION_DAYS,
  tokenHash,
} from './auth-sessions.service';
import { AccountTokensService } from './account-tokens.service';
import { CurrentUser, Public } from './decorators/auth.decorators';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/account.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: AuthSessionsService,
    private readonly tokens: AccountTokensService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    const result = await this.auth.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    return this.withCookie(result, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    return this.withCookie(await this.sessions.refresh(this.cookie(req)), res);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.checkOrigin(req);
    const hash = tokenHash(this.cookie(req));
    const session = await this.prisma.authSession.findFirst({
      where: {
        OR: [{ refreshHash: hash }, { previousRefreshHash: hash }],
        revokedAt: null,
      },
    });
    if (session) {
      await this.prisma.authSession.updateMany({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await this.audit.log(session.userId, 'LOGOUT', 'auth', session.id);
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { message: 'Đã đăng xuất' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('activate')
  @HttpCode(200)
  async activate(@Body() dto: ResetPasswordDto) {
    await this.tokens.consume(dto.token, dto.password, 'INVITE');
    return { message: 'Đã kích hoạt tài khoản. Vui lòng đăng nhập.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() dto: ResetPasswordDto) {
    await this.tokens.consume(dto.token, dto.password, 'RESET');
    return { message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' };
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.session(user);
  }

  private cookie(req: Request): string {
    return (
      req.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${REFRESH_COOKIE}=`))
        ?.slice(REFRESH_COOKIE.length + 1) ?? ''
    );
  }
  private withCookie<T extends { refreshToken: string }>(
    result: T,
    res: Response,
  ): Omit<T, 'refreshToken'> {
    const { refreshToken, ...body } = result;
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/api/v1/auth',
      maxAge: SESSION_DAYS * 86400000,
    });
    return body;
  }
  private checkOrigin(req: Request): void {
    const origin = req.headers.origin;
    const allowed = this.config
      .get<string>('CORS_ORIGIN', 'http://localhost:4200')
      .split(',')
      .map((value) => value.trim());
    if (origin && !allowed.includes(origin))
      throw new ForbiddenException('Nguồn truy cập không hợp lệ');
  }
}
