import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import {
  ReminderSettingsDto,
  ServiceThresholdsDto,
} from './dto/reminder-settings.dto';
import { ReminderSettingsService } from './reminder-settings.service';

/** Cấu hình nhắc việc và ngưỡng mức gấp theo dịch vụ (06, I9/I11). */
@ApiTags('deadlines')
@ApiBearerAuth()
@Controller()
export class ReminderSettingsController {
  constructor(private readonly settings: ReminderSettingsService) {}

  @Get('reminder-settings')
  @RequirePermission('settings', 'view')
  get() {
    return this.settings.get();
  }

  @Put('reminder-settings')
  @RequirePermission('settings', 'update')
  update(@CurrentUser() user: AuthUser, @Body() dto: ReminderSettingsDto) {
    return this.settings.update(user, dto);
  }

  @Get('service-urgency-thresholds')
  @RequirePermission('settings', 'view')
  list() {
    return this.settings.listServiceThresholds();
  }

  @Put('service-urgency-thresholds/:serviceTypeId')
  @RequirePermission('settings', 'update')
  set(
    @CurrentUser() user: AuthUser,
    @Param('serviceTypeId', ParseUUIDPipe) serviceTypeId: string,
    @Body() dto: ServiceThresholdsDto,
  ) {
    return this.settings.setServiceThresholds(user, serviceTypeId, dto);
  }

  @Delete('service-urgency-thresholds/:serviceTypeId')
  @RequirePermission('settings', 'update')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('serviceTypeId', ParseUUIDPipe) serviceTypeId: string,
  ) {
    return this.settings.removeServiceThresholds(user, serviceTypeId);
  }
}
