import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { MAX_UPLOAD_BYTES } from '../documents/documents.service';
import { DocumentRequestsService } from './document-requests.service';
import {
  DocumentRequestQueryDto,
  MarkRequestedDto,
  RequestNoteDto,
  SupplementDto,
} from './dto/document-request.dto';

/** Hồ sơ yêu cầu của khách (đặc tả 05-D). Xem: `tasks:view`; thao tác: `tasks:update` (kiểm ở service). */
@ApiTags('tasks')
@ApiBearerAuth()
@Controller('customer-document-requests')
export class DocumentRequestsController {
  constructor(private readonly requests: DocumentRequestsService) {}

  @Get()
  @RequirePermission('tasks', 'view')
  list(@CurrentUser() user: AuthUser, @Query() query: DocumentRequestQueryDto) {
    return this.requests.list(user, query);
  }

  @Get(':id')
  @RequirePermission('tasks', 'view')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requests.detail(user, id);
  }

  @Post(':id/request')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  markRequested(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkRequestedDto,
  ) {
    return this.requests.markRequested(user, id, dto);
  }

  @Post(':id/upload')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: RequestNoteDto,
  ) {
    return this.requests.upload(user, id, file, dto.note);
  }

  @Post(':id/review')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requests.review(user, id);
  }

  @Post(':id/supplement')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  supplement(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SupplementDto,
  ) {
    return this.requests.supplement(user, id, dto.note);
  }

  @Post(':id/accept')
  @HttpCode(200)
  @RequirePermission('tasks', 'update')
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestNoteDto,
  ) {
    return this.requests.accept(user, id, dto.note);
  }
}
