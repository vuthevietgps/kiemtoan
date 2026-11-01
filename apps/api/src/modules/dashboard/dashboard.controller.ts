import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import {
  DashboardQueryDto,
  ServiceListQueryDto,
} from './dto/dashboard-query.dto';
import { FinanceOverviewService } from './finance-overview.service';
import { OperationsOverviewService } from './operations-overview.service';

/** Tổng quan (đặc tả 10, M1): tab Vận hành cho mọi người có `dashboard:view`, tab Tài chính theo quyền. */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly operations: OperationsOverviewService,
    private readonly finance: FinanceOverviewService,
  ) {}

  @Get('operations')
  @RequirePermission('dashboard', 'view')
  operationsOverview(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.operations.overview(query, user);
  }

  @Get('operations/services')
  @RequirePermission('dashboard', 'view')
  services(@Query() query: ServiceListQueryDto, @CurrentUser() user: AuthUser) {
    return this.operations.services(query, user);
  }

  @Get('finance')
  @RequirePermission('dashboard', 'view')
  financeOverview(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!hasPermission(user, 'finance', 'view'))
      throw new ForbiddenException(
        'Bạn không có quyền truy cập dữ liệu tài chính',
      );
    return this.finance.overview(query, user);
  }
}
