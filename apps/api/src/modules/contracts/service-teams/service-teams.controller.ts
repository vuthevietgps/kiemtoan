import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../../core/auth/decorators/auth.decorators';
import { SaveServiceTeamDto } from '../dto/service-team.dto';
import { ServiceTeamsService } from './service-teams.service';

/** Nhóm thực hiện dòng dịch vụ kế toán (đặc tả 05, H8); sửa cần `contracts:plan`. */
@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts/:id/services/:lineId/team')
export class ServiceTeamsController {
  constructor(private readonly teams: ServiceTeamsService) {}

  @Get()
  @RequirePermission('contracts', 'view')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.teams.get(user, id, lineId);
  }

  @Put()
  @RequirePermission('contracts', 'plan')
  save(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: SaveServiceTeamDto,
  ) {
    return this.teams.save(user, id, lineId, dto);
  }
}
