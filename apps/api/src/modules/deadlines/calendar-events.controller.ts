import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CurrentUser } from '../../core/auth/decorators/auth.decorators';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEventsQueryDto } from './dto/calendar-events.dto';

/**
 * Lịch & Deadline (06, I14). Cần `deadlines:view` hoặc `tasks:view` — kiểm ở service vì mỗi quyền
 * chỉ mở phần dữ liệu tương ứng.
 */
@ApiTags('deadlines')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarEventsController {
  constructor(private readonly events: CalendarEventsService) {}

  @Get('events')
  list(@CurrentUser() user: AuthUser, @Query() query: CalendarEventsQueryDto) {
    return this.events.list(user, query);
  }
}
