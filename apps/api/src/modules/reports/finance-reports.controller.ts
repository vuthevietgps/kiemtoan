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
import { RevenueMeasuresQueryDto } from './dto/report-query.dto';
import { FinanceReportsService } from './finance-reports.service';
import { revenueCsv, revenueXlsx } from './utils/revenue-export';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function checkExport(user: AuthUser): void {
  if (!hasPermission(user, 'reports', 'export'))
    throw new ForbiddenException('Bạn không có quyền xuất báo cáo');
}

/**
 * Báo cáo tài chính (đặc tả 10-D): Doanh thu 3 thước đo. Xem cần `reports:view_financial` (guard kiểm
 * thêm `finance:view`); Excel / CSV cần `reports:export`. Công nợ và Hoá đơn dùng lại API 07 / 08.
 */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class FinanceReportsController {
  constructor(private readonly reports: FinanceReportsService) {}

  @Get('revenue')
  @RequirePermission('reports', 'view_financial')
  async revenue(
    @Query() query: RevenueMeasuresQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.format === 'csv') checkExport(user);
    const data = await this.reports.revenue(query, user);
    if (query.format !== 'csv') return data;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="bao-cao-doanh-thu.csv"',
    );
    return revenueCsv(data);
  }

  @Get('revenue/export')
  @RequirePermission('reports', 'view_financial')
  async revenueExport(
    @Query() query: RevenueMeasuresQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    checkExport(user);
    const data = await this.reports.revenue(query, user);
    response.setHeader('Content-Type', XLSX);
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="bao-cao-doanh-thu.xlsx"',
    );
    response.send(revenueXlsx(data));
  }
}
