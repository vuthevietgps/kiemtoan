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
import { OperationsReportQueryDto } from './dto/report-query.dto';
import { OperationsReportsService } from './operations-reports.service';
import {
  complianceXlsx,
  contractsXlsx,
  customersXlsx,
} from './utils/operations-report-xlsx';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Excel cần thêm `reports:export` (một decorator chỉ khai được một quyền). */
function checkExport(user: AuthUser): void {
  if (!hasPermission(user, 'reports', 'export'))
    throw new ForbiddenException('Bạn không có quyền xuất báo cáo');
}

function send(response: Response, data: Buffer, name: string): void {
  response.setHeader('Content-Type', XLSX);
  response.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  response.send(data);
}

/**
 * Báo cáo vận hành (đặc tả 10-C): xem cần `reports:view_operations`; Excel cần thêm `reports:export`
 * (đường dẫn `/export` được nhật ký chung ghi EXPORT).
 */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class OperationsReportsController {
  constructor(private readonly reports: OperationsReportsService) {}

  @Get('deadline-compliance')
  @RequirePermission('reports', 'view_operations')
  compliance(
    @Query() query: OperationsReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.deadlineCompliance(query, user);
  }

  @Get('deadline-compliance/export')
  @RequirePermission('reports', 'view_operations')
  async complianceExport(
    @Query() query: OperationsReportQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    checkExport(user);
    const data = await this.reports.deadlineCompliance(query, user);
    send(response, complianceXlsx(data), 'tuan-thu-deadline.xlsx');
  }

  @Get('contracts')
  @RequirePermission('reports', 'view_operations')
  contracts(
    @Query() query: OperationsReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.contracts(query, user);
  }

  @Get('contracts/export')
  @RequirePermission('reports', 'view_operations')
  async contractsExport(
    @Query() query: OperationsReportQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    checkExport(user);
    const data = await this.reports.contracts(query, user);
    send(response, contractsXlsx(data), 'bao-cao-hop-dong.xlsx');
  }

  @Get('customers')
  @RequirePermission('reports', 'view_operations')
  customers(
    @Query() query: OperationsReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.customers(query, user);
  }

  @Get('customers/export')
  @RequirePermission('reports', 'view_operations')
  async customersExport(
    @Query() query: OperationsReportQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    checkExport(user);
    const data = await this.reports.customers(query, user);
    send(response, customersXlsx(data), 'bao-cao-khach-hang.xlsx');
  }
}
