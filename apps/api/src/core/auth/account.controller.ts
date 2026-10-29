import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth-user.interface';
import { AuthService } from './auth.service';
import { AuthSessionsService } from './auth-sessions.service';
import { CurrentUser } from './decorators/auth.decorators';
import { ChangePasswordDto, PasswordDto, ProfileDto } from './dto/account.dto';

@ApiTags('account')
@ApiBearerAuth()
@Controller('auth')
export class AccountController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: AuthSessionsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        title: true,
        role: true,
        team: { select: { id: true, name: true } },
      },
    });
  }
  @Patch('profile')
  async update(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: dto.fullName.trim(),
        phone: dto.phone,
        title: dto.title,
      },
    });
    return this.profile(user);
  }
  @Post('change-password')
  async password(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(user, dto.currentPassword, dto.password);
    return {
      message: 'Đã đổi mật khẩu và thu hồi các phiên. Vui lòng đăng nhập lại.',
    };
  }
  @Post('verify-password')
  async verify(@CurrentUser() user: AuthUser, @Body() dto: PasswordDto) {
    await this.auth.verifyPassword(user, dto.password);
    return { message: 'Đã xác nhận mật khẩu trong 5 phút' };
  }
  @Get('sessions')
  list(@CurrentUser() user: AuthUser) {
    return this.sessions.list(user.id, user.sessionId);
  }
  @Delete('sessions/:id')
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.prisma.authSession.updateMany({
      where: { id, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log(user.id, 'REVOKE_SESSION', 'auth', id);
    return { message: 'Đã thu hồi phiên' };
  }
  @Delete('sessions')
  async revokeAll(@CurrentUser() user: AuthUser) {
    await this.prisma.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log(user.id, 'REVOKE_ALL_SESSIONS', 'auth', user.id);
    return { message: 'Đã thu hồi tất cả phiên' };
  }
}
