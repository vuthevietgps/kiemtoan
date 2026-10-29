import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { ContractsApprovalService } from './contracts-approval.service';
import { ContractsCommandService } from './contracts-command.service';
import { ContractsQueryService } from './contracts-query.service';
import {
  ChangeStatusDto,
  ContractQueryDto,
  CreateContractDto,
  ReturnContractDto,
  UpdateContractDto,
} from './dto/contract.dto';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly query: ContractsQueryService,
    private readonly command: ContractsCommandService,
    private readonly approval: ContractsApprovalService,
  ) {}

  @Get()
  @RequirePermission('contracts', 'view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: ContractQueryDto) {
    return this.query.findAll(user, query);
  }

  @Get(':id')
  @RequirePermission('contracts', 'view')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.query.findOne(user, id);
  }

  @Post()
  @RequirePermission('contracts', 'create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContractDto) {
    return this.command.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('contracts', 'update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.command.update(user, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermission('contracts', 'update')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.approval.submit(user, id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('contracts', 'approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.approval.approve(user, id);
  }

  @Post(':id/return')
  @HttpCode(200)
  @RequirePermission('contracts', 'approve')
  returnToDraft(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnContractDto,
  ) {
    return this.approval.returnToDraft(user, id, dto.reason);
  }

  /** Sinh lại việc cho dòng dịch vụ chưa sinh/lỗi của HĐ đã duyệt (đặc tả 04-A). */
  @Post(':id/generate-tasks')
  @HttpCode(200)
  @RequirePermission('contracts', 'update')
  regenerateTasks(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.approval.regenerateTasks(user, id);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermission('contracts', 'update')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.command.changeStatus(user, id, dto.status, dto.reason);
  }
}
