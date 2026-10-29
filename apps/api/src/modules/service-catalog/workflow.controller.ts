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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import {
  CloneWorkflowVersionDto,
  CreateWorkflowTemplateDto,
  SaveWorkflowVersionDto,
  UpdateWorkflowTemplateDto,
  WorkflowPreviewQueryDto,
  WorkflowTemplateQueryDto,
} from './dto/workflow.dto';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowVersionsService } from './workflow-versions.service';

/** Quy trình mẫu có phiên bản (đặc tả 03-B, quyền theo D1). */
@ApiTags('workflow-templates')
@ApiBearerAuth()
@Controller()
export class WorkflowController {
  constructor(
    private readonly templates: WorkflowTemplatesService,
    private readonly versions: WorkflowVersionsService,
  ) {}

  @Get('workflow-templates')
  @RequirePermission('workflow-templates', 'view')
  findAll(@Query() query: WorkflowTemplateQueryDto) {
    return this.templates.findAll(query);
  }

  @Post('workflow-templates')
  @RequirePermission('workflow-templates', 'create')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWorkflowTemplateDto,
  ) {
    return this.templates.create(user, dto);
  }

  @Get('workflow-templates/:id')
  @RequirePermission('workflow-templates', 'view')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.findOne(id);
  }

  @Patch('workflow-templates/:id')
  @RequirePermission('workflow-templates', 'update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowTemplateDto,
  ) {
    return this.templates.update(user, id, dto);
  }

  @Get('workflow-versions/:id')
  @RequirePermission('workflow-templates', 'view')
  findVersion(@Param('id', ParseUUIDPipe) id: string) {
    return this.versions.findOne(id);
  }

  @Put('workflow-versions/:id')
  @RequirePermission('workflow-templates', 'update')
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveWorkflowVersionDto,
  ) {
    return this.versions.save(id, dto);
  }

  @Post('workflow-versions/:id/clone')
  @RequirePermission('workflow-templates', 'create')
  clone(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloneWorkflowVersionDto,
  ) {
    return this.versions.clone(user, id, dto);
  }

  @Post('workflow-versions/:id/publish')
  @RequirePermission('workflow-templates', 'approve')
  publish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.versions.publish(user, id);
  }

  @Delete('workflow-versions/:id')
  @RequirePermission('workflow-templates', 'update')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.versions.remove(id);
  }

  @Get('workflow-versions/:id/preview')
  @RequirePermission('workflow-templates', 'view')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: WorkflowPreviewQueryDto,
  ) {
    return this.versions.preview(id, query);
  }

  @Get('service-types/:id/effective-workflow')
  @RequirePermission('service-catalog', 'view')
  effective(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.effectiveForService(id);
  }
}
