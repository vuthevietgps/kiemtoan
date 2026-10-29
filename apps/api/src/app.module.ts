import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './core/auth/auth.module';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './core/prisma/prisma.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { ClientCredentialsModule } from './modules/client-credentials/client-credentials.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DeadlinesModule } from './modules/deadlines/deadlines.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ServiceCatalogModule } from './modules/service-catalog/service-catalog.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    // 06-C: tác vụ nhắc việc định kỳ (tắt khi test — xem ReminderService).
    ScheduleModule.forRoot(),
    PrismaModule,
    CoreModule,
    AuditModule,
    AuthModule,
    UsersModule,
    AuditLogModule,
    CustomersModule,
    DocumentsModule,
    ClientCredentialsModule,
    ServiceCatalogModule,
    ContractsModule,
    PaymentsModule,
    InvoicesModule,
    TasksModule,
    DeadlinesModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
  ],
})
export class AppModule {}
