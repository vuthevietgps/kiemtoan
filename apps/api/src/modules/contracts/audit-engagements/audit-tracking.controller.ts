import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../../core/auth/decorators/auth.decorators';
import {
  AuditBoardQueryDto,
  AuditPeopleQueryDto,
} from '../dto/audit-engagement.dto';
import { AuditBoardQuery } from './audit-board.query';
import { AuditPeopleQuery } from './audit-people.query';

/**
 * Theo dõi kiểm toán (đặc tả 04-F). Đăng ký trước ContractsController để /contracts/audit-tracking
 * không bị route /contracts/:id bắt mất. Phạm vi người được xem kiểm tra ở query (F11).
 */
@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts/audit-tracking')
export class AuditTrackingController {
  constructor(
    private readonly people: AuditPeopleQuery,
    private readonly boardQuery: AuditBoardQuery,
  ) {}

  @Get()
  @RequirePermission('contracts', 'view')
  board(@CurrentUser() user: AuthUser, @Query() query: AuditBoardQueryDto) {
    return this.boardQuery.board(user, query);
  }

  @Get('people')
  @RequirePermission('contracts', 'view')
  list(@CurrentUser() user: AuthUser, @Query() query: AuditPeopleQueryDto) {
    return this.people.people(user, query);
  }

  @Get('people/:userId')
  @RequirePermission('contracts', 'view')
  person(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AuditPeopleQueryDto,
  ) {
    return this.people.person(user, userId, query);
  }
}
