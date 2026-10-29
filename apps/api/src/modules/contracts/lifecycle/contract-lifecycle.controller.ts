import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../../core/auth/decorators/auth.decorators';
import {
  BusinessInfoDto,
  ExpiringQueryDto,
  RenewalStatsQueryDto,
} from '../dto/lifecycle.dto';
import { ContractLifecycleService } from './contract-lifecycle.service';

/**
 * Vòng đời HĐ (đặc tả 04-D). Đăng ký trước ContractsController để /contracts/expiring
 * không bị route /contracts/:id bắt mất.
 */
@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractLifecycleController {
  constructor(private readonly lifecycle: ContractLifecycleService) {}

  @Get('expiring')
  @RequirePermission('contracts', 'view')
  expiring(@CurrentUser() user: AuthUser, @Query() query: ExpiringQueryDto) {
    return this.lifecycle.expiring(user, query.days);
  }

  @Get('renewal-stats')
  @RequirePermission('contracts', 'view')
  renewalStats(
    @CurrentUser() user: AuthUser,
    @Query() query: RenewalStatsQueryDto,
  ) {
    return this.lifecycle.renewalStats(user, query.from, query.to);
  }

  @Patch(':id/business-info')
  @RequirePermission('contracts', 'update')
  updateBusinessInfo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BusinessInfoDto,
  ) {
    return this.lifecycle.updateBusinessInfo(user, id, dto);
  }

  @Post(':id/renew')
  @RequirePermission('contracts', 'create')
  renew(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lifecycle.renew(user, id);
  }

  @Get(':id/history')
  @RequirePermission('contracts', 'view')
  history(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.lifecycle.history(user, id, query);
  }
}
