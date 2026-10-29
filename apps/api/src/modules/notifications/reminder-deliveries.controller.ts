import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { DeliveryQueryDto } from './dto/notification.dto';
import { ReminderDeliveriesService } from './reminder-deliveries.service';
import { ReminderService } from './reminder.service';

/** Nhật ký gửi nhắc việc và chạy nhắc thủ công (đặc tả 06, I12). Quyền `settings:view/update`. */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class ReminderDeliveriesController {
  constructor(
    private readonly deliveries: ReminderDeliveriesService,
    private readonly reminders: ReminderService,
  ) {}

  @Get('notification-deliveries')
  @RequirePermission('settings', 'view')
  list(@Query() query: DeliveryQueryDto) {
    return this.deliveries.list(query);
  }

  @Post('notification-deliveries/:id/retry')
  @HttpCode(200)
  @RequirePermission('settings', 'update')
  retry(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.deliveries.retry(user, id);
  }

  /** Chạy một lượt nhắc ngay (dùng khi kiểm thử/UAT); vẫn qua khoá thuê và chống gửi trùng. */
  @Post('reminders/run')
  @HttpCode(200)
  @RequirePermission('settings', 'update')
  run() {
    return this.reminders.runOnce();
  }
}
