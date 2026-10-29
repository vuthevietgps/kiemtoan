import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { DocumentTemplateType } from '@prisma/client';
import type { Response } from 'express';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../../core/auth/decorators/auth.decorators';
import type { UploadedFileInfo } from '../../../core/storage/storage.service';
import { MAX_UPLOAD_BYTES } from '../../documents/documents.service';
import {
  CreateTemplateDto,
  GenerateDocumentDto,
  TemplateQueryDto,
  TemplateVersionDto,
  UpdateTemplateDto,
  UploadSignedDto,
} from '../dto/commercial-document.dto';
import { ContractDocumentsService } from './contract-documents.service';
import { DocumentTemplatesService } from './document-templates.service';

const FILE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'private, no-store',
};
const upload = () =>
  UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  );

/**
 * Mẫu hồ sơ thương mại (đặc tả 04-C). Quản lý mẫu chỉ giám đốc: dùng quyền `contracts:approve`
 * (không có ở trưởng nhóm, nhân viên, thu tiền, quản trị). Xem danh sách mẫu cần `contracts:view`.
 */
@ApiTags('contracts')
@ApiBearerAuth()
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly templates: DocumentTemplatesService) {}

  @Get()
  @RequirePermission('contracts', 'view')
  list(@Query() query: TemplateQueryDto) {
    return this.templates.list(query);
  }

  @Get('fields')
  @RequirePermission('contracts', 'view')
  fields() {
    return this.templates.fields();
  }

  @Get('samples/:type/download')
  @RequirePermission('contracts', 'approve')
  async sample(
    @Param('type', new ParseEnumPipe(DocumentTemplateType))
    type: DocumentTemplateType,
    @Res() response: Response,
  ) {
    const file = await this.templates.sample(type);
    response.set(FILE_HEADERS).attachment(file.fileName).send(file.buffer);
  }

  @Post()
  @RequirePermission('contracts', 'approve')
  @ApiConsumes('multipart/form-data')
  @upload()
  create(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templates.create(user, file, dto);
  }

  @Patch(':id')
  @RequirePermission('contracts', 'approve')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templates.update(user, id, dto);
  }

  @Get(':id/versions')
  @RequirePermission('contracts', 'approve')
  versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.versions(id);
  }

  @Post(':id/versions')
  @RequirePermission('contracts', 'approve')
  @ApiConsumes('multipart/form-data')
  @upload()
  addVersion(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body() dto: TemplateVersionDto,
  ) {
    return this.templates.addVersion(user, id, file, dto.note);
  }

  @Get(':id/versions/:version/download')
  @RequirePermission('contracts', 'approve')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Res() response: Response,
  ) {
    const file = await this.templates.fileOf(id, version);
    response.set(FILE_HEADERS).download(file.path, file.fileName);
  }
}

/** Hồ sơ thương mại trên hợp đồng: danh sách, tạo từ mẫu, tải bản scan đã ký. */
@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts/:id/documents')
export class ContractDocumentsController {
  constructor(private readonly documents: ContractDocumentsService) {}

  @Get()
  @RequirePermission('contracts', 'view')
  list(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.list(user, id);
  }

  @Post('generate')
  @RequirePermission('contracts', 'update')
  generate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateDocumentDto,
  ) {
    return this.documents.generate(user, id, dto);
  }

  @Post('signed')
  @RequirePermission('contracts', 'update')
  @ApiConsumes('multipart/form-data')
  @upload()
  uploadSigned(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body() dto: UploadSignedDto,
  ) {
    return this.documents.uploadSigned(user, id, file, dto);
  }
}
