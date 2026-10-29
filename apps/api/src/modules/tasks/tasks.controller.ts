import {
  Body,
  Controller,
  Get,
  GoneException,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import {
  BulkReassignDto,
  CalendarQueryDto,
  CreateTaskDto,
  MyTasksQueryDto,
  EvidenceDto,
  ReviewTaskDto,
  TaskNoteDto,
  TaskQueryDto,
  TaskSummaryQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { MyTasksQuery } from './my-tasks.query';
import { TaskWorkflowService } from './task-workflow.service';
import { TasksQueryService } from './tasks-query.service';
import { TasksService } from './tasks.service';

/** API 3 trạng thái cũ đã thay (đặc tả 05): báo rõ cho client cũ trong một phiên bản rồi bỏ. */
const REPLACED =
  'API đã thay bằng /tasks/:id/start, /submit, /complete, /review, /deliver (đặc tả 05)';

const MAX_EVIDENCE_SIZE = 20 * 1024 * 1024;

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly query: TasksQueryService,
    private readonly workflow: TaskWorkflowService,
    private readonly my: MyTasksQuery,
  ) {}

  @Get()
  @RequirePermission('tasks', 'view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: TaskQueryDto) {
    return this.query.findAll(user, query);
  }

  @Get('summary')
  @RequirePermission('tasks', 'view')
  summary(@CurrentUser() user: AuthUser, @Query() query: TaskSummaryQueryDto) {
    return this.query.summary(user, query);
  }

  @Get('by-customer')
  @RequirePermission('tasks', 'approve')
  byCustomer(@CurrentUser() user: AuthUser) {
    return this.query.byCustomer(user);
  }

  @Get('workload')
  @RequirePermission('tasks', 'approve')
  workload(@CurrentUser() user: AuthUser) {
    return this.query.workload(user);
  }

  @Get('calendar')
  @RequirePermission('tasks', 'view')
  calendar(@CurrentUser() user: AuthUser, @Query() query: CalendarQueryDto) {
    return this.query.calendar(user, query);
  }

  /** Việc đang chờ tôi kiểm tra (cấp 1) hoặc phê duyệt (cấp 2), kèm thời gian chờ và SLA (G7). */
  @Get('review-queue')
  @RequirePermission('tasks', 'view')
  reviewQueue(@CurrentUser() user: AuthUser) {
    return this.my.reviewQueue(user);
  }

  /** Việc của tôi: Hôm nay / Sắp đến hạn / Quá hạn / Đã hoàn thành (05-E). */
  @Get('my')
  @RequirePermission('tasks', 'view')
  myTasks(@CurrentUser() user: AuthUser, @Query() query: MyTasksQueryDto) {
    return this.my.my(user, query);
  }

  /** Giao lại hàng loạt (người quản lý việc từng việc — R2). */
  @Post('reassign')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  reassign(@CurrentUser() user: AuthUser, @Body() dto: BulkReassignDto) {
    return this.tasks.reassign(user, dto);
  }

  @Get(':id')
  @RequirePermission('tasks', 'view')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.query.findOne(user, id);
  }

  @Post()
  @RequirePermission('tasks', 'create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('tasks', 'update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user, id, dto);
  }

  @Post(':id/start')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  start(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workflow.start(user, id);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflow.submit(user, id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskNoteDto,
  ) {
    return this.workflow.complete(user, id, dto.note);
  }

  /** Kiểm tra/phê duyệt dựa vào người được chỉ định, không vào vai trò; cần `tasks:update`. */
  @Post(':id/review')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewTaskDto,
  ) {
    return this.workflow.review(user, id, dto.decision, dto.note);
  }

  @Post(':id/deliver')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  deliver(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskNoteDto,
  ) {
    return this.workflow.deliver(user, id, dto.note);
  }

  @Post(':id/status')
  @RequirePermission('tasks', 'update')
  changeStatus(): never {
    throw new GoneException(REPLACED);
  }

  @Post(':id/evidence')
  @RequirePermission('tasks', 'update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_EVIDENCE_SIZE } }),
  )
  addEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: EvidenceDto,
  ) {
    return this.tasks.addEvidence(user, id, file, dto.note);
  }

  @Post(':id/approve')
  @RequirePermission('tasks', 'update')
  approve(): never {
    throw new GoneException(REPLACED);
  }
}
