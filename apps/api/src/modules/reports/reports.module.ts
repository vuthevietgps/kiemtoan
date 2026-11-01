import { Module } from '@nestjs/common';
import { ContractsModule } from '../contracts/contracts.module';
import { CapabilityTasksQuery } from './capability-tasks.query';
import { CapabilityTeamQuery } from './capability-team.query';
import { CapabilityController } from './capability.controller';
import { CapabilityService } from './capability.service';
import { FinanceReportsController } from './finance-reports.controller';
import { FinanceReportsService } from './finance-reports.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { OperationsReportsController } from './operations-reports.controller';
import { OperationsReportsService } from './operations-reports.service';
import { ReportExporterService } from './report-exporter.service';
import { ReportScheduleService } from './report-schedule.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SavedFiltersController } from './saved-filters.controller';
import { SavedFiltersService } from './saved-filters.service';

@Module({
  imports: [ContractsModule, NotificationsModule],
  controllers: [
    CapabilityController,
    SavedFiltersController,
    ReportsController,
    OperationsReportsController,
    FinanceReportsController,
  ],
  providers: [
    ReportsService,
    OperationsReportsService,
    FinanceReportsService,
    CapabilityService,
    CapabilityTasksQuery,
    CapabilityTeamQuery,
    ReportExporterService,
    SavedFiltersService,
    ReportScheduleService,
  ],
})
export class ReportsModule {}
