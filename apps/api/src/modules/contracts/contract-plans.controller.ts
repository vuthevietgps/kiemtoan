import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { ContractPlansService } from './contract-plans.service';
import {
  CreatePlanDto,
  PreviewPlanDto,
  UpdatePlanDto,
} from './dto/contract-plan.dto';

/** Kế hoạch thực hiện dòng dịch vụ (đặc tả 04-B); sửa/xác nhận cần `contracts:plan` (E2). */
@ApiTags('contracts')
@ApiBearerAuth()
@Controller()
export class ContractPlansController {
  constructor(private readonly plans: ContractPlansService) {}

  @Get('contracts/:id/plans')
  @RequirePermission('contracts', 'view')
  list(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.list(user, id);
  }

  @Post('contracts/:id/services/:lineId/plan')
  @RequirePermission('contracts', 'plan')
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: CreatePlanDto,
  ) {
    return this.plans.create(user, id, lineId, dto);
  }

  @Put('contract-plans/:planId')
  @RequirePermission('contracts', 'plan')
  update(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.update(user, planId, dto);
  }

  @Post('contract-plans/:planId/preview')
  @HttpCode(200)
  @RequirePermission('contracts', 'plan')
  preview(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: PreviewPlanDto,
  ) {
    return this.plans.preview(user, planId, dto);
  }

  @Post('contract-plans/:planId/confirm')
  @HttpCode(200)
  @RequirePermission('contracts', 'plan')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.plans.confirm(user, planId);
  }

  @Post('contract-plans/:planId/reopen')
  @HttpCode(200)
  @RequirePermission('contracts', 'plan')
  reopen(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.plans.reopen(user, planId);
  }
}
