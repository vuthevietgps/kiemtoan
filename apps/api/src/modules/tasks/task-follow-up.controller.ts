import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import {
  DueChangeRequestDto,
  DueDecisionDto,
  OptionalNoteDto,
  ReasonDto,
  WaitClientDto,
} from './dto/task-follow-up.dto';
import { TaskCommentDto } from './dto/task.dto';
import { TaskCommentsService } from './task-comments.service';
import { TaskFollowUpService } from './task-follow-up.service';

/** Chờ khách, tạm dừng, mở lại, gia hạn, xác nhận khoảng chờ (đặc tả 05-D). Ai làm gì kiểm ở service. */
@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks/:id')
export class TaskFollowUpController {
  constructor(
    private readonly followUp: TaskFollowUpService,
    private readonly comments: TaskCommentsService,
  ) {}

  /** Bình luận (05-E): ai xem được việc thì bình luận được. */
  @Post('comments')
  @RequirePermission('tasks', 'view')
  comment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskCommentDto,
  ) {
    return this.comments.add(user, id, dto.content);
  }

  @Post('wait-client')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  waitClient(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WaitClientDto,
  ) {
    return this.followUp.waitClient(user, id, dto);
  }

  @Post('resume')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  resume(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OptionalNoteDto,
  ) {
    return this.followUp.resume(user, id, dto.note);
  }

  @Post('hold')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  hold(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.followUp.hold(user, id, dto.reason);
  }

  @Post('unhold')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  unhold(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OptionalNoteDto,
  ) {
    return this.followUp.unhold(user, id, dto.note);
  }

  @Post('reopen')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  reopen(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.followUp.reopen(user, id, dto.reason);
  }

  @Post('due-changes')
  @RequirePermission('tasks', 'update')
  requestDueChange(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DueChangeRequestDto,
  ) {
    return this.followUp.requestDueChange(user, id, dto);
  }

  @Post('due-changes/:changeId/decide')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  decideDueChange(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('changeId', ParseUUIDPipe) changeId: string,
    @Body() dto: DueDecisionDto,
  ) {
    return this.followUp.decideDueChange(user, id, changeId, dto);
  }

  @Post('client-waits/:waitId/confirm')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  confirmWait(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('waitId', ParseUUIDPipe) waitId: string,
  ) {
    return this.followUp.confirmWait(user, id, waitId);
  }
}
