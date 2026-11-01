import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { FinanceOverviewService } from './finance-overview.service';
import { OperationsOverviewService } from './operations-overview.service';

@Module({
  controllers: [DashboardController],
  providers: [OperationsOverviewService, FinanceOverviewService],
})
export class DashboardModule {}
