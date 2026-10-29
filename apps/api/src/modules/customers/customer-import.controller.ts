import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
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
import { CustomerImportService } from './customer-import.service';
import { ConfirmCustomerImportDto } from './dto/customer-import.dto';
import { CustomerQueryDto } from './dto/customer.dto';

@ApiTags('customer-import')
@ApiBearerAuth()
@Controller('customers')
export class CustomerImportController {
  constructor(private readonly imports: CustomerImportService) {}

  @Get('import-template')
  @RequirePermission('customers', 'create')
  async template(@Res() response: Response) {
    this.send(
      response,
      await this.imports.template(),
      'customer-import-template.xlsx',
    );
  }

  @Post('imports/preview')
  @RequirePermission('customers', 'create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  preview(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: UploadedFileInfo,
  ) {
    if (file && !file.originalname.toLowerCase().endsWith('.xlsx'))
      throw new BadRequestException('Chỉ nhận file XLSX');
    return this.imports.preview(user, file?.buffer);
  }

  @Post('imports/:id/confirm')
  @RequirePermission('customers', 'create')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmCustomerImportDto,
  ) {
    return this.imports.confirm(user, id, dto.rows);
  }

  @Get('export')
  @RequirePermission('customers', 'view')
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: CustomerQueryDto,
    @Res() response: Response,
  ) {
    this.send(
      response,
      await this.imports.export(user, query),
      'customers.xlsx',
    );
  }

  private send(response: Response, buffer: Buffer, fileName: string) {
    response.type(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.attachment(fileName).send(buffer);
  }
}
