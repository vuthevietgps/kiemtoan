import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceKind, InvoiceStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsMoney } from '../../contracts/dto/money.decorator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && !value.trim() ? null : trim({ value });

/** Người mua trên hoá đơn (K7) — bản chụp, sửa được trước khi xuất. */
export class InvoiceBuyerDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 300, { message: 'Tên người mua từ 1 đến 300 ký tự' })
  buyerName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20, { message: 'Mã số thuế người mua tối đa 20 ký tự' })
  buyerTaxCode?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  buyerAddress?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail({}, { message: 'Email nhận hoá đơn không hợp lệ' })
  buyerEmail?: string | null;
}

/** Đề nghị xuất (K2): theo đợt (`installmentIds`) hoặc theo giá trị trước VAT (`subtotal`). */
export class CreateInvoiceDto extends InvoiceBuyerDto {
  @IsUUID('all', { message: 'Vui lòng chọn hợp đồng' })
  contractId: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true, message: 'Đợt thanh toán không hợp lệ' })
  installmentIds?: string[];

  @ApiPropertyOptional({
    description:
      'Giá trị trước VAT; bỏ trống và không chọn đợt = phần chưa xuất hoá đơn',
  })
  @IsOptional()
  @IsMoney('Giá trị hoá đơn không hợp lệ')
  subtotal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class InvoiceRevisionDto {
  @Type(() => Number)
  @IsInt({ message: 'Thiếu phiên bản dữ liệu (revision)' })
  @Min(1)
  revision: number;
}

/** Sửa đề nghị chưa xuất: người mua, ghi chú. */
export class UpdateInvoiceDto extends InvoiceBuyerDto {
  @IsInt({ message: 'Thiếu phiên bản dữ liệu (revision)' })
  @Min(1)
  revision: number;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

/** Thông tin hoá đơn đã xuất trên cổng EasyInvoice (K5); file gửi kèm multipart. */
export class InvoiceIdentityDto extends InvoiceRevisionDto {
  @Transform(trim)
  @IsString()
  @Length(1, 10, { message: 'Ký hiệu mẫu số từ 1 đến 10 ký tự' })
  templateCode: string;

  @Transform(trim)
  @IsString()
  @Length(1, 20, { message: 'Ký hiệu hoá đơn từ 1 đến 20 ký tự' })
  symbol: string;

  @Transform(trim)
  @IsString()
  @Length(1, 20, { message: 'Số hoá đơn từ 1 đến 20 ký tự' })
  number: string;

  @IsDateString({}, { message: 'Ngày lập hoá đơn không hợp lệ' })
  issueDate: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  lookupCode?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  taxAuthorityCode?: string | null;
}

export class IssueInvoiceDto extends InvoiceIdentityDto {}

/** Lý do bắt buộc (5–500 ký tự): huỷ đề nghị, điều chỉnh, thay thế. */
export class CancelInvoiceDto extends InvoiceRevisionDto {
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Lý do từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do từ 5 đến 500 ký tự' })
  reason: string;
}

/** Hoá đơn điều chỉnh tăng / giảm (K6): số tiền trước VAT dương, chiều theo `direction`. */
export class AdjustInvoiceDto extends InvoiceIdentityDto {
  @IsIn(['INCREASE', 'DECREASE'], { message: 'Chọn điều chỉnh tăng hoặc giảm' })
  direction: 'INCREASE' | 'DECREASE';

  @IsMoney('Số tiền điều chỉnh không hợp lệ')
  subtotal: string;

  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Lý do từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do từ 5 đến 500 ký tự' })
  reason: string;
}

/** Hoá đơn thay thế (K6): giá trị trước VAT mới, người mua có thể sửa. */
export class ReplaceInvoiceDto extends InvoiceIdentityDto {
  @IsMoney('Giá trị hoá đơn thay thế không hợp lệ')
  subtotal: string;

  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Lý do từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do từ 5 đến 500 ký tự' })
  reason: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 300)
  buyerName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  buyerTaxCode?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  buyerAddress?: string | null;
}

export class InvoiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ enum: InvoiceKind })
  @IsOptional()
  @IsEnum(InvoiceKind)
  kind?: InvoiceKind;

  @IsOptional()
  @IsUUID('all')
  contractId?: string;

  @IsOptional()
  @IsUUID('all')
  customerId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

/** Đối chiếu thu – xuất (08 K8): lọc KH, tìm HĐ/KH, đến ngày, chỉ HĐ chênh lệch. */
export class ReconciliationQueryDto {
  @IsOptional()
  @IsUUID('all')
  customerId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  mismatchOnly?: boolean;
}
