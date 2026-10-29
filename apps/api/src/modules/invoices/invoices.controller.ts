import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { MAX_UPLOAD_BYTES } from '../documents/documents.service';
import {
  AdjustInvoiceDto,
  CancelInvoiceDto,
  CreateInvoiceDto,
  InvoiceQueryDto,
  IssueInvoiceDto,
  ReconciliationQueryDto,
  ReplaceInvoiceDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';
import { InvoicesQueryService } from './invoices-query.service';
import { InvoicesReconciliationService } from './invoices-reconciliation.service';
import { InvoiceFiles, InvoicesService } from './invoices.service';

type UploadedInvoiceFiles = {
  pdf?: Express.Multer.File[];
  xml?: Express.Multer.File[];
};

/** Multipart: `pdf` (bắt buộc khi ghi nhận xuất), `xml` (tuỳ chọn), cùng các trường của DTO. */
const InvoiceFileFields = () =>
  UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'pdf', maxCount: 1 },
        { name: 'xml', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_UPLOAD_BYTES } },
    ),
  );

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendXlsx(response: Response, data: Buffer, fileName: string) {
  response.setHeader('Content-Type', XLSX);
  response.setHeader(
    'Content-Disposition',
    'attachment; filename="' + fileName + '"',
  );
  response.send(data);
}

const filesOf = (files: UploadedInvoiceFiles | undefined): InvoiceFiles => ({
  pdf: files?.pdf?.[0],
  xml: files?.xml?.[0],
});

/**
 * Sổ hoá đơn nội bộ (08): xem và đối chiếu thu – xuất theo `invoices:view`; xuất Excel theo `invoices:export`; đề nghị / sửa đề nghị theo `invoices:create`;
 * ghi nhận xuất, điều chỉnh, thay thế, huỷ đề nghị theo `invoices:update`. Không xoá hoá đơn.
 */
@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly query: InvoicesQueryService,
    private readonly reconciliationQuery: InvoicesReconciliationService,
  ) {}

  @Get()
  @RequirePermission('invoices', 'view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: InvoiceQueryDto) {
    return this.query.findAll(user, query);
  }

  @Get('export')
  @RequirePermission('invoices', 'export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: InvoiceQueryDto,
    @Res() response: Response,
  ) {
    sendXlsx(
      response,
      await this.query.exportInvoices(user, query),
      'so-hoa-don.xlsx',
    );
  }

  /** 08 K8: đối chiếu thu – xuất theo HĐ. */
  @Get('reconciliation')
  @RequirePermission('invoices', 'view')
  reconciliation(
    @CurrentUser() user: AuthUser,
    @Query() query: ReconciliationQueryDto,
  ) {
    return this.reconciliationQuery.reconciliation(user, query);
  }

  @Get('reconciliation/export')
  @RequirePermission('invoices', 'export')
  async exportReconciliation(
    @CurrentUser() user: AuthUser,
    @Query() query: ReconciliationQueryDto,
    @Res() response: Response,
  ) {
    sendXlsx(
      response,
      await this.reconciliationQuery.exportReconciliation(user, query),
      'doi-chieu-thu-xuat.xlsx',
    );
  }

  @Get(':id')
  @RequirePermission('invoices', 'view')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.query.findOne(user, id);
  }

  @Post()
  @RequirePermission('invoices', 'create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('invoices', 'create')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoices.update(user, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('invoices', 'update')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    return this.invoices.cancel(user, id, dto);
  }

  @Post(':id/issue')
  @HttpCode(200)
  @RequirePermission('invoices', 'update')
  @ApiConsumes('multipart/form-data')
  @InvoiceFileFields()
  issue(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: UploadedInvoiceFiles | undefined,
    @Body() dto: IssueInvoiceDto,
  ) {
    return this.invoices.issue(user, id, filesOf(files), dto);
  }

  @Post(':id/adjust')
  @RequirePermission('invoices', 'update')
  @ApiConsumes('multipart/form-data')
  @InvoiceFileFields()
  adjust(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: UploadedInvoiceFiles | undefined,
    @Body() dto: AdjustInvoiceDto,
  ) {
    return this.invoices.adjust(user, id, filesOf(files), dto);
  }

  @Post(':id/replace')
  @RequirePermission('invoices', 'update')
  @ApiConsumes('multipart/form-data')
  @InvoiceFileFields()
  replace(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: UploadedInvoiceFiles | undefined,
    @Body() dto: ReplaceInvoiceDto,
  ) {
    return this.invoices.replace(user, id, filesOf(files), dto);
  }
}
