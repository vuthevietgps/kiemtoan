import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../core/auth/decorators/auth.decorators';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('audit-log')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @RequirePermission('audit-log', 'view')
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLog.findAll(query);
  }

  @Get('entities')
  @RequirePermission('audit-log', 'view')
  entities() {
    return this.auditLog.entities();
  }

  @Get('export')
  @RequirePermission('audit-log', 'export')
  async export(@Query() query: AuditLogQueryDto, @Res() response: Response) {
    const data = await this.auditLog.export(query);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="nhat-ky-hoat-dong.xlsx"',
    );
    response.send(data);
  }
}
