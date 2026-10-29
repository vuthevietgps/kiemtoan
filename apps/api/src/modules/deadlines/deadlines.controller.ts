import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { BusinessCalendarService } from './business-calendar.service';
import {
  CreateObligationTypeDto,
  ObligationPreviewQueryDto,
  ReasonDto,
  RevisionDto,
  SaveCalendarDaysDto,
  SaveObligationDraftDto,
  SetObligationServicesDto,
  UpdateObligationTypeDto,
} from './dto/deadlines.dto';
import { ObligationTypesService } from './obligation-types.service';

/**
 * Cấu hình 06 (I1, I2): lịch làm việc theo năm và danh mục loại nghĩa vụ. Xem lịch: mọi người đăng
 * nhập; soạn: `deadlines:create`; xác nhận/ngừng: `deadlines:approve` (sửa năm đã xác nhận kiểm ở service).
 */
@ApiTags('deadlines')
@ApiBearerAuth()
@Controller()
export class DeadlinesController {
  constructor(
    private readonly calendar: BusinessCalendarService,
    private readonly types: ObligationTypesService,
  ) {}

  @Get('business-calendar/:year')
  getYear(@Param('year', ParseIntPipe) year: number) {
    return this.calendar.get(year);
  }

  @Put('business-calendar/:year')
  @RequirePermission('deadlines', 'create')
  saveYear(
    @CurrentUser() user: AuthUser,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: SaveCalendarDaysDto,
  ) {
    return this.calendar.saveDays(user, year, dto);
  }

  @Post('business-calendar/:year/confirm')
  @HttpCode(200)
  @RequirePermission('deadlines', 'approve')
  confirmYear(
    @CurrentUser() user: AuthUser,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: RevisionDto,
  ) {
    return this.calendar.confirm(user, year, dto);
  }

  @Get('obligation-types')
  @RequirePermission('deadlines', 'view')
  listTypes() {
    return this.types.list();
  }

  @Get('obligation-types/:id')
  @RequirePermission('deadlines', 'view')
  getType(@Param('id', ParseUUIDPipe) id: string) {
    return this.types.findOne(id);
  }

  @Get('obligation-types/:id/preview')
  @RequirePermission('deadlines', 'view')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ObligationPreviewQueryDto,
  ) {
    return this.types.preview(id, query);
  }

  @Post('obligation-types')
  @RequirePermission('deadlines', 'create')
  createType(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateObligationTypeDto,
  ) {
    return this.types.create(user, dto);
  }

  @Patch('obligation-types/:id')
  @RequirePermission('deadlines', 'create')
  updateType(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateObligationTypeDto,
  ) {
    return this.types.update(user, id, dto);
  }

  @Put('obligation-types/:id/draft')
  @RequirePermission('deadlines', 'create')
  saveDraft(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveObligationDraftDto,
  ) {
    return this.types.saveDraft(user, id, dto);
  }

  @Post('obligation-types/:id/draft/confirm')
  @HttpCode(200)
  @RequirePermission('deadlines', 'approve')
  confirmDraft(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisionDto,
  ) {
    return this.types.confirm(user, id, dto);
  }

  @Post('obligation-types/:id/retire')
  @HttpCode(200)
  @RequirePermission('deadlines', 'approve')
  retire(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.types.retire(user, id, dto);
  }

  @Put('obligation-types/:id/services')
  @RequirePermission('deadlines', 'create')
  setServices(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetObligationServicesDto,
  ) {
    return this.types.setServices(user, id, dto);
  }
}
