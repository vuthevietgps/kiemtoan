import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CapabilityService } from './capability.service';
import { CapabilityQueryDto } from './dto/report-query.dto';
import { capabilityXlsx } from './utils/capability-xlsx';

/**
 * Đánh giá năng lực (đặc tả 10-E). Xem cần `reports:view_operations` (nhân viên thấy chính mình — G9);
 * Excel cần thêm `reports:export`. Thay báo cáo demo "Hiệu suất nhân viên" / "Tuân thủ deadline" theo việc.
 */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports/capability')
export class CapabilityController {
  constructor(private readonly capability: CapabilityService) {}

  @Get()
  @RequirePermission('reports', 'view_operations')
  report(@Query() query: CapabilityQueryDto, @CurrentUser() user: AuthUser) {
    return this.capability.report(query, user);
  }

  @Get('export')
  @RequirePermission('reports', 'view_operations')
  async export(
    @Query() query: CapabilityQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    if (!hasPermission(user, 'reports', 'export'))
      throw new ForbiddenException('Bạn không có quyền xuất báo cáo');
    const data = await this.capability.report(query, user);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="danh-gia-nang-luc.xlsx"',
    );
    response.send(capabilityXlsx(data));
  }

  @Get(':userId')
  @RequirePermission('reports', 'view_operations')
  items(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: CapabilityQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.capability.items(userId, query, user);
  }
}
