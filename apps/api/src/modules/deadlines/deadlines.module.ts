import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { BusinessCalendarService } from './business-calendar.service';
import { CalendarEventsController } from './calendar-events.controller';
import { CalendarEventsService } from './calendar-events.service';
import { CustomerObligationsController } from './customer-obligations.controller';
import { CustomerObligationsService } from './customer-obligations.service';
import { DeadlinesController } from './deadlines.controller';
import { ObligationEngine } from './obligation-engine.service';
import { ObligationTypesService } from './obligation-types.service';
import { ReminderSettingsController } from './reminder-settings.controller';
import { ReminderSettingsService } from './reminder-settings.service';

/** Lịch làm việc, loại nghĩa vụ pháp lý, lịch báo cáo theo khách hàng (đặc tả 06-B). */
@Module({
  // Biên nhận nộp lưu vào kho hồ sơ 02 qua DocumentsService.
  imports: [DocumentsModule],
  controllers: [
    DeadlinesController,
    CustomerObligationsController,
    ReminderSettingsController,
    CalendarEventsController,
  ],
  providers: [
    ObligationEngine,
    CalendarEventsService,
    BusinessCalendarService,
    ObligationTypesService,
    CustomerObligationsService,
    ReminderSettingsService,
  ],
})
export class DeadlinesModule {}
