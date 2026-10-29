import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import {
  NotificationListQueryDto,
  PreferencesDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import { ReminderDeliveriesService } from './reminder-deliveries.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly deliveries: ReminderDeliveriesService,
  ) {}

  /** 06 (I10): tuỳ chọn nhận email nhắc việc và bản tin sáng của chính mình. */
  @Get('preferences')
  @RequirePermission('notifications', 'view')
  preferences(@CurrentUser() user: AuthUser) {
    return this.deliveries.preferences(user.id);
  }

  @Put('preferences')
  @RequirePermission('notifications', 'view')
  setPreferences(@CurrentUser() user: AuthUser, @Body() dto: PreferencesDto) {
    return this.deliveries.setPreferences(user.id, dto);
  }

  /** 20 thông báo mới nhất của tôi (hoặc chỉ chưa đọc) + số chưa đọc. */
  @Get()
  @RequirePermission('notifications', 'view')
  latest(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notifications.latest(user.id, query.unread);
  }

  @Post('read-all')
  @HttpCode(200)
  @RequirePermission('notifications', 'view')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  @RequirePermission('notifications', 'view')
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }
}
