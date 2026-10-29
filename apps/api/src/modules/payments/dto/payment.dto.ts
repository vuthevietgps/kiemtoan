import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsMoney } from '../../contracts/dto/money.decorator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePaymentDto {
  @IsUUID('all', { message: 'Vui lòng chọn hợp đồng' })
  contractId: string;

  @IsOptional()
  @IsUUID('all')
  installmentId?: string;

  @IsMoney('Số tiền thu không hợp lệ')
  amount: string;

  @IsDateString({}, { message: 'Ngày thu không hợp lệ' })
  paidDate: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Hình thức thanh toán không hợp lệ' })
  method?: PaymentMethod;

  /** Số phiếu thu giấy / mã giao dịch (J8). */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Số chứng từ tối đa 100 ký tự' })
  documentNumber?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

/** Sửa phiếu Nháp / Trả lại (người lập). Không đổi hợp đồng. */
export class UpdatePaymentDto {
  @IsInt({ message: 'Thiếu phiên bản dữ liệu (revision)' })
  @Min(1)
  revision: number;

  @IsOptional()
  @IsUUID('all')
  installmentId?: string | null;

  @IsOptional()
  @IsMoney('Số tiền thu không hợp lệ')
  amount?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày thu không hợp lệ' })
  paidDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Hình thức thanh toán không hợp lệ' })
  method?: PaymentMethod;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Số chứng từ tối đa 100 ký tự' })
  documentNumber?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class PaymentRevisionDto {
  @Type(() => Number)
  @IsInt({ message: 'Thiếu phiên bản dữ liệu (revision)' })
  @Min(1)
  revision: number;
}

/** Trả lại / huỷ phiếu đã duyệt: lý do bắt buộc (J5). Rút phiếu: lý do tuỳ chọn. */
export class PaymentReasonDto extends PaymentRevisionDto {
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Lý do từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do từ 5 đến 500 ký tự' })
  reason: string;
}

export class PaymentWithdrawDto extends PaymentRevisionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  reason?: string;
}

/** Đính kèm chứng từ: tải file mới (multipart) hoặc dùng lại tài liệu đã có của KH (J6). */
export class AttachDocumentDto {
  @IsOptional()
  @IsUUID('all', { message: 'Tài liệu không hợp lệ' })
  documentId?: string;
}

export class PaymentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all')
  contractId?: string;

  @IsOptional()
  @IsUUID('all')
  customerId?: string;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'Trạng thái phiếu không hợp lệ' })
  status?: PaymentStatus;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ReceivableQueryDto {
  @IsOptional()
  @IsUUID('all')
  customerId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

/** Danh sách đợt sắp đến hạn (trong `days` ngày, mặc định 7) hoặc quá hạn (07-D1). */
export class DueInstallmentQueryDto extends ReceivableQueryDto {
  @ApiPropertyOptional({ enum: ['upcoming', 'overdue'] })
  @IsIn(['upcoming', 'overdue'], { message: 'Bộ lọc hạn không hợp lệ' })
  due: 'upcoming' | 'overdue';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;
}
