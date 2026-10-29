import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditDeadlineKind } from '@prisma/client';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../../core/auth/decorators/auth.decorators';
import type { UploadedFileInfo } from '../../../core/storage/storage.service';
import { MAX_UPLOAD_BYTES } from '../../documents/documents.service';
import {
  AuditNoteDto,
  AuditPriorityDto,
  ChangeAuditStageDto,
  ContractDossierDto,
  ExtendAuditDeadlineDto,
  IssueAuditReportDto,
  ReopenAuditReportDto,
  SaveAuditEngagementDto,
} from '../dto/audit-engagement.dto';
import { AuditDeadlinesService } from './audit-deadlines.service';
import { AuditEngagementsQuery } from './audit-engagements.query';
import { AuditEngagementsService } from './audit-engagements.service';
import { AuditNotesService } from './audit-notes.service';
import { ContractDossierService } from './contract-dossier.service';

/**
 * Theo dõi hợp đồng kiểm toán (đặc tả 04-F). Sửa nhóm/giai đoạn: `contracts:plan` hoặc trưởng nhóm
 * của hồ sơ (kiểm tra ở service, F2); phát hành/mở lại: Giám đốc (`contracts:approve`, F4).
 */
@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts/:id')
export class AuditEngagementsController {
  constructor(
    private readonly query: AuditEngagementsQuery,
    private readonly engagements: AuditEngagementsService,
    private readonly dossier: ContractDossierService,
    private readonly deadlines: AuditDeadlinesService,
    private readonly notes: AuditNotesService,
  ) {}

  /** Mức độ (04-F4): người theo F2; không cần revision. */
  @Put('audit-engagements/:lineId/priority')
  @RequirePermission('contracts', 'view')
  setPriority(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: AuditPriorityDto,
  ) {
    return this.notes.setPriority(user, id, lineId, dto.priority);
  }

  /** Báo cáo tình hình cụ thể (04-F4): người theo F2 hoặc thành viên nhóm; chỉ thêm. */
  @Post('audit-engagements/:lineId/notes')
  @RequirePermission('contracts', 'view')
  addNote(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: AuditNoteDto,
  ) {
    return this.notes.addNote(user, id, lineId, dto.content);
  }

  @Get('audit-engagements')
  @RequirePermission('contracts', 'view')
  list(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.query.get(user, id);
  }

  @Put('audit-engagements/:lineId')
  @RequirePermission('contracts', 'view')
  save(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: SaveAuditEngagementDto,
  ) {
    return this.engagements.save(user, id, lineId, dto);
  }

  @Post('audit-engagements/:lineId/stage')
  @HttpCode(200)
  @RequirePermission('contracts', 'view')
  changeStage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: ChangeAuditStageDto,
  ) {
    return this.engagements.changeStage(user, id, lineId, dto);
  }

  @Post('audit-engagements/:lineId/issue')
  @HttpCode(200)
  @RequirePermission('contracts', 'approve')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  issue(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body() dto: IssueAuditReportDto,
  ) {
    return this.engagements.issue(user, id, lineId, file, dto);
  }

  @Post('audit-engagements/:lineId/reopen')
  @HttpCode(200)
  @RequirePermission('contracts', 'approve')
  reopen(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: ReopenAuditReportDto,
  ) {
    return this.engagements.reopen(user, id, lineId, dto);
  }

  /** Gia hạn sau khi chốt (F9): chỉ Giám đốc. */
  @Post('audit-engagements/:lineId/deadlines/:kind/extend')
  @HttpCode(200)
  @RequirePermission('contracts', 'approve')
  extendDeadline(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Param('kind', new ParseEnumPipe(AuditDeadlineKind))
    kind: AuditDeadlineKind,
    @Body() dto: ExtendAuditDeadlineDto,
  ) {
    return this.deadlines.extend(user, id, lineId, kind, dto);
  }

  @Put('dossier')
  @RequirePermission('contracts', 'update')
  updateDossier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContractDossierDto,
  ) {
    return this.dossier.update(user, id, dto);
  }
}
