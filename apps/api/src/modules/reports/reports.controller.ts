import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { hasPermission } from '../../core/access-control/permissions';
import { redactFinancialFields } from '../../core/access-control/financial-fields';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import {
  ReportExportQueryDto,
  ReportPeriodQueryDto,
  RevenueReportQueryDto,
} from './dto/report-query.dto';
import { ReportsService } from './reports.service';
import {
  complianceCsv,
  receivablesCsv,
  revenueCsv,
  staffPerformanceCsv,
} from './utils/report-csv.util';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('revenue')
  @RequirePermission('reports', 'view_financial')
  async revenue(
    @Query() query: RevenueReportQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkExport(query, user);
    const data = await this.reports.revenue(query, user);
    return query.format === 'csv'
      ? this.csv(res, 'bao-cao-doanh-thu', revenueCsv(data))
      : data;
  }

  @Get('receivables')
  @RequirePermission('reports', 'view_financial')
  async receivables(
    @Query() query: ReportExportQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkExport(query, user);
    const data = await this.reports.receivables(user);
    return query.format === 'csv'
      ? this.csv(res, 'bao-cao-cong-no', receivablesCsv(data))
      : data;
  }

  @Get('task-compliance')
  @RequirePermission('reports', 'view_operations')
  async taskCompliance(
    @Query() query: ReportPeriodQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkExport(query, user);
    const data = await this.reports.taskCompliance(query, user);
    return query.format === 'csv'
      ? this.csv(res, 'bao-cao-tuan-thu-deadline', complianceCsv(data))
      : data;
  }

  @Get('staff-performance')
  @RequirePermission('reports', 'view_operations')
  async staffPerformance(
    @Query() query: ReportPeriodQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkExport(query, user);
    const data = await this.reports.staffPerformance(query, user);
    const financial = hasPermission(user, 'finance', 'view');
    return query.format === 'csv'
      ? this.csv(
          res,
          'bao-cao-hieu-suat-nhan-vien',
          staffPerformanceCsv(data, financial),
        )
      : financial
        ? data
        : redactFinancialFields(data);
  }

  /** Xuất file cần thêm quyền reports:export. */
  private checkExport(query: ReportExportQueryDto, user: AuthUser): void {
    if (query.format === 'csv' && !hasPermission(user, 'reports', 'export')) {
      throw new ForbiddenException('Bạn không có quyền xuất báo cáo');
    }
  }

  private csv(res: Response, name: string, content: string): string {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${name}-${date}.csv"`,
    );
    return content;
  }
}
