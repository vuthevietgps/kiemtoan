import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { MAX_UPLOAD_BYTES } from '../documents/documents.service';
import { CustomerObligationsService } from './customer-obligations.service';
import {
  FileObligationDto,
  ObligationActionDto,
  ObligationQueryDto,
  ObligationReasonDto,
  ObligationSettingDto,
  ObligationSummaryQueryDto,
} from './dto/deadlines.dto';

/** Lịch báo cáo theo khách hàng (đặc tả 06, I4–I7). Phạm vi theo phân công khách hàng (02, F6). */
@ApiTags('deadlines')
@ApiBearerAuth()
@Controller()
export class CustomerObligationsController {
  constructor(private readonly obligations: CustomerObligationsService) {}

  @Get('customer-obligations')
  @RequirePermission('deadlines', 'view')
  list(@CurrentUser() user: AuthUser, @Query() query: ObligationQueryDto) {
    return this.obligations.list(user, query);
  }

  @Get('customer-obligations/summary')
  @RequirePermission('deadlines', 'view')
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: ObligationSummaryQueryDto,
  ) {
    return this.obligations.summary(user, query);
  }

  @Get('customer-obligations/:id')
  @RequirePermission('deadlines', 'view')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.obligations.findOne(user, id);
  }

  @Post('customer-obligations/:id/prepare')
  @HttpCode(200)
  @RequirePermission('deadlines', 'update')
  prepare(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ObligationActionDto,
  ) {
    return this.obligations.prepare(user, id, dto);
  }

  @Post('customer-obligations/:id/file')
  @HttpCode(200)
  @RequirePermission('deadlines', 'update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  file(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: FileObligationDto,
  ) {
    return this.obligations.file(user, id, file, dto);
  }

  @Post('customer-obligations/:id/not-applicable')
  @HttpCode(200)
  @RequirePermission('deadlines', 'update')
  notApplicable(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ObligationReasonDto,
  ) {
    return this.obligations.notApplicable(user, id, dto);
  }

  @Post('customer-obligations/:id/reopen')
  @HttpCode(200)
  @RequirePermission('deadlines', 'approve')
  reopen(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ObligationReasonDto,
  ) {
    return this.obligations.reopen(user, id, dto);
  }

  @Get('customers/:customerId/obligation-settings')
  @RequirePermission('deadlines', 'view')
  settings(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.obligations.settings(user, customerId);
  }

  @Put('customers/:customerId/obligation-settings/:typeId')
  @RequirePermission('deadlines', 'update')
  setSetting(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('typeId', ParseUUIDPipe) typeId: string,
    @Body() dto: ObligationSettingDto,
  ) {
    return this.obligations.setSetting(user, customerId, typeId, dto);
  }
}
