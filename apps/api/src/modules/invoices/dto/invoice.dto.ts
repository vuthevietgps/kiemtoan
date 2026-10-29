import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsMoney } from '../../contracts/dto/money.decorator';

export class CreateInvoiceDto {
  @IsUUID('all', { message: 'Vui lòng chọn hợp đồng' })
  contractId: string;

  @ApiPropertyOptional({
    description: 'Giá trị trước VAT; bỏ trống = phần chưa xuất hoá đơn',
  })
  @IsOptional()
  @IsMoney('Giá trị hoá đơn không hợp lệ')
  subtotal?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class IssueInvoiceDto {
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập số hoá đơn' })
  number: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập ký hiệu hoá đơn' })
  symbol: string;

  @IsDateString({}, { message: 'Ngày phát hành không hợp lệ' })
  issueDate: string;
}

export class InvoiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsUUID('all')
  contractId?: string;
}
