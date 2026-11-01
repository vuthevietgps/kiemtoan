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
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { ReportExportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';
import { receivablesCsv } from './utils/report-csv.util';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

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
