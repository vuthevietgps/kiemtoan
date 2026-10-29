import { Module } from '@nestjs/common';
import { NotificationMailer } from './notification-mailer';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReminderDeliveriesController } from './reminder-deliveries.controller';
import { ReminderDeliveriesService } from './reminder-deliveries.service';
import { ReminderService } from './reminder.service';

/** Thông báo trong ứng dụng (05) và nhắc việc theo lịch qua ứng dụng/email (06-C). */
@Module({
  controllers: [NotificationsController, ReminderDeliveriesController],
  providers: [
    NotificationsService,
    NotificationMailer,
    ReminderService,
    ReminderDeliveriesService,
  ],
})
export class NotificationsModule {}
