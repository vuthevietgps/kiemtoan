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
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../../core/auth/decorators/auth.decorators';
import { ReturnContractDto } from '../dto/contract.dto';
import { SaveAmendmentDto } from '../dto/contract-amendment.dto';
import { ContractAmendmentsService } from './contract-amendments.service';

/**
 * Phụ lục HĐ (đặc tả 04-D). Đường dẫn nằm dưới /contracts để bộ lọc trường tài chính ẩn tiền
 * với người không có quyền xem tài chính. Lập/sửa/gửi/huỷ: `contracts:update`; duyệt/trả lại: `contracts:approve`.
 */
@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts/:id/amendments')
export class ContractAmendmentsController {
  constructor(private readonly amendments: ContractAmendmentsService) {}

  @Get()
  @RequirePermission('contracts', 'view')
  list(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.amendments.list(user, id);
  }

  @Post()
  @RequirePermission('contracts', 'update')
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAmendmentDto,
  ) {
    return this.amendments.create(user, id, dto);
  }

  @Put(':amendmentId')
  @RequirePermission('contracts', 'update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amendmentId', ParseUUIDPipe) amendmentId: string,
    @Body() dto: SaveAmendmentDto,
  ) {
    return this.amendments.update(user, id, amendmentId, dto);
  }

  @Post(':amendmentId/submit')
  @HttpCode(200)
  @RequirePermission('contracts', 'update')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amendmentId', ParseUUIDPipe) amendmentId: string,
  ) {
    return this.amendments.submit(user, id, amendmentId);
  }

  @Post(':amendmentId/cancel')
  @HttpCode(200)
  @RequirePermission('contracts', 'update')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amendmentId', ParseUUIDPipe) amendmentId: string,
  ) {
    return this.amendments.cancel(user, id, amendmentId);
  }

  @Post(':amendmentId/approve')
  @HttpCode(200)
  @RequirePermission('contracts', 'approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amendmentId', ParseUUIDPipe) amendmentId: string,
  ) {
    return this.amendments.approve(user, id, amendmentId);
  }

  @Post(':amendmentId/return')
  @HttpCode(200)
  @RequirePermission('contracts', 'approve')
  returnToDraft(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amendmentId', ParseUUIDPipe) amendmentId: string,
    @Body() dto: ReturnContractDto,
  ) {
    return this.amendments.returnToDraft(user, id, amendmentId, dto.reason);
  }
}
