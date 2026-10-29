import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import type { UploadedFileInfo } from '../../core/storage/storage.service';
import {
  DocumentQueryDto,
  UploadDocumentDto,
  UploadVersionDto,
} from './dto/document.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DocumentsService, MAX_UPLOAD_BYTES } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('customers/:customerId/documents')
  @RequirePermission('documents', 'view')
  list(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: DocumentQueryDto,
  ) {
    return this.documents.list(user, customerId, query);
  }

  @Post('customers/:customerId/documents')
  @RequirePermission('documents', 'create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documents.upload(user, customerId, file, dto);
  }

  /** Tải file — dùng chung cho hồ sơ khách hàng và bằng chứng công việc. Token có thể qua ?token=. */
  @Get('documents/:id/download')
  @RequirePermission('documents', 'view')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.documents.fileOf(user, id);
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    res.download(file.path, file.fileName);
  }

  @Delete('documents/:id')
  @RequirePermission('documents', 'delete')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.remove(user, id);
  }

  @Get('documents/:id/versions')
  @RequirePermission('documents', 'view')
  versions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.documents.versions(user, id, query);
  }

  @Post('documents/:id/versions')
  @RequirePermission('documents', 'create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  addVersion(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body() dto: UploadVersionDto,
  ) {
    return this.documents.addVersion(user, id, file, dto);
  }

  @Get('documents/:id/versions/:version/download')
  @RequirePermission('documents', 'view')
  async downloadVersion(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Res() response: Response,
  ) {
    const file = await this.documents.fileOf(user, id, version);
    response.set({
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    response.download(file.path, file.fileName);
  }

  @Get('documents/:id/versions/:version/preview')
  @RequirePermission('documents', 'view')
  async previewVersion(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Res() response: Response,
  ) {
    const file = await this.documents.fileOf(user, id, version, true);
    response.type(file.mimeType).attachment(file.fileName);
    response.set({
      'Content-Disposition': response
        .get('Content-Disposition')!
        .replace(/^attachment/, 'inline'),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': 'sandbox',
    });
    response.sendFile(file.path);
  }
}
