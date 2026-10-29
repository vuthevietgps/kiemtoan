import {
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  HttpCode,
  Param,
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
import type { Response } from 'express';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { ContractDocumentsService } from '../contracts/commercial-documents/contract-documents.service';
import { PaymentRequestDto } from '../contracts/dto/commercial-document.dto';
import { MAX_UPLOAD_BYTES } from '../documents/documents.service';
import {
  AttachDocumentDto,
  CreatePaymentDto,
  DueInstallmentQueryDto,
  PaymentQueryDto,
  PaymentReasonDto,
  PaymentRevisionDto,
  PaymentWithdrawDto,
  ReceivableQueryDto,
  UpdatePaymentDto,
} from './dto/payment.dto';
import { PaymentsQueryService } from './payments-query.service';
import { PaymentsService } from './payments.service';
import { ReceivablesQueryService } from './receivables-query.service';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendXlsx(response: Response, data: Buffer, fileName: string) {
  response.setHeader('Content-Type', XLSX);
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${fileName}"`,
  );
  response.send(data);
}

/**
 * Thu tiền (07): xem theo `payments:view`; lập/sửa/gửi/rút/chứng từ theo `payments:create` (người lập);
 * duyệt/trả lại/huỷ theo `payments:approve` (không tự duyệt). Không xoá phiếu (J5).
 */
@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly query: PaymentsQueryService,
    private readonly receivableQuery: ReceivablesQueryService,
    private readonly contractDocuments: ContractDocumentsService,
  ) {}

  /** 07-D3 (J9): xem trước đề nghị thanh toán (số tiền, nội dung, ảnh VietQR). */
  @Post('payment-requests/preview')
  @HttpCode(200)
  @RequirePermission('payments', 'create')
  previewPaymentRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: PaymentRequestDto,
  ) {
    return this.contractDocuments.previewPaymentRequest(user, dto);
  }

  /** 07-D3 (J9): tạo DOCX đề nghị thanh toán, lưu kho hồ sơ gắn HĐ. */
  @Post('payment-requests')
  @RequirePermission('payments', 'create')
  createPaymentRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: PaymentRequestDto,
  ) {
    return this.contractDocuments.generatePaymentRequest(user, dto);
  }

  @Get()
  @RequirePermission('payments', 'view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: PaymentQueryDto) {
    return this.query.findAll(user, query);
  }

  @Get('export')
  @RequirePermission('payments', 'export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: PaymentQueryDto,
    @Res() response: Response,
  ) {
    const data = await this.query.exportPayments(user, query);
    sendXlsx(response, data, 'phieu-thu.xlsx');
  }

  @Get('receivables')
  @RequirePermission('payments', 'view')
  receivables(
    @CurrentUser() user: AuthUser,
    @Query() query: ReceivableQueryDto,
  ) {
    return this.receivableQuery.receivables(user, query);
  }

  /** Đợt sắp đến hạn / quá hạn (07-D1). */
  @Get('receivables/installments')
  @RequirePermission('payments', 'view')
  dueInstallments(
    @CurrentUser() user: AuthUser,
    @Query() query: DueInstallmentQueryDto,
  ) {
    return this.receivableQuery.dueInstallments(user, query);
  }

  @Get('receivables/export')
  @RequirePermission('payments', 'export')
  async exportReceivables(
    @CurrentUser() user: AuthUser,
    @Query() query: ReceivableQueryDto,
    @Res() response: Response,
  ) {
    const data = await this.receivableQuery.exportReceivables(user, query);
    sendXlsx(response, data, 'cong-no.xlsx');
  }

  @Get(':id')
  @RequirePermission('payments', 'view')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.query.findOne(user, id);
  }

  @Post()
  @RequirePermission('payments', 'create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('payments', 'create')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.payments.update(user, id, dto);
  }

  @Post(':id/documents')
  @RequirePermission('payments', 'create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  attach(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: AttachDocumentDto,
  ) {
    return this.payments.attachDocument(user, id, file, dto);
  }

  @Delete(':id/documents/:documentId')
  @RequirePermission('payments', 'create')
  detach(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.payments.detachDocument(user, id, documentId);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermission('payments', 'create')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentRevisionDto,
  ) {
    return this.payments.submit(user, id, dto.revision);
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  @RequirePermission('payments', 'create')
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentWithdrawDto,
  ) {
    return this.payments.withdraw(user, id, dto.revision, dto.reason);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('payments', 'approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentRevisionDto,
  ) {
    return this.payments.approve(user, id, dto.revision);
  }

  @Post(':id/return')
  @HttpCode(200)
  @RequirePermission('payments', 'approve')
  returnPayment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentReasonDto,
  ) {
    return this.payments.returnPayment(user, id, dto.revision, dto.reason);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('payments', 'approve')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentReasonDto,
  ) {
    return this.payments.cancel(user, id, dto.revision, dto.reason);
  }

  /** J5: không xoá phiếu thu — dùng rút phiếu (chưa duyệt) hoặc huỷ có lý do (đã duyệt). */
  @Delete(':id')
  remove(): never {
    throw new GoneException(
      'Không xoá phiếu thu. Rút phiếu chưa duyệt hoặc huỷ phiếu đã duyệt kèm lý do',
    );
  }
}
