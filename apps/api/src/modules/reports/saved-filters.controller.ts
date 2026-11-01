import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import {
  CreateSavedFilterDto,
  SavedFilterExportQueryDto,
  SavedFilterQueryDto,
  SaveScheduleDto,
  UpdateSavedFilterDto,
} from './dto/saved-filter.dto';
import { SavedFiltersService } from './saved-filters.service';

/**
 * Bộ lọc đã lưu và hẹn gửi (đặc tả 10-F, M11–M12). Cần `reports:view`; quyền từng báo cáo và
 * `reports:export` kiểm trong service. Đường dẫn `/export` được nhật ký chung ghi EXPORT.
 */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports/saved-filters')
export class SavedFiltersController {
  constructor(private readonly filters: SavedFiltersService) {}

  @Get()
  @RequirePermission('reports', 'view')
  list(@Query() query: SavedFilterQueryDto, @CurrentUser() user: AuthUser) {
    return this.filters.list(query, user);
  }

  @Post()
  @RequirePermission('reports', 'view')
  create(@Body() dto: CreateSavedFilterDto, @CurrentUser() user: AuthUser) {
    return this.filters.create(dto, user);
  }

  @Get(':id')
  @RequirePermission('reports', 'view')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.filters.get(id, user);
  }

  @Patch(':id')
  @RequirePermission('reports', 'view')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.filters.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('reports', 'view')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.filters.remove(id, user);
  }

  @Put(':id/schedule')
  @RequirePermission('reports', 'export')
  saveSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.filters.saveSchedule(id, dto, user);
  }

  /** Xoá lịch luôn được, kể cả khi đã mất quyền xuất. */
  @Delete(':id/schedule')
  @RequirePermission('reports', 'view')
  removeSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.filters.removeSchedule(id, user);
  }

  @Get(':id/export')
  @RequirePermission('reports', 'export')
  async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SavedFilterExportQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const file = await this.filters.export(id, query, user);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    response.send(file.buffer);
  }
}
