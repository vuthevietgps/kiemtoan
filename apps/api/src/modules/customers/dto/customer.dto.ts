import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  AccountingRegime,
  CustomerStatus,
  PitPeriod,
  TaxPeriod,
  VatMethod,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCustomerDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên khách hàng' })
  @MaxLength(200, { message: 'Nội dung vượt giới hạn 200 ký tự' })
  name: string;

  @Transform(trim)
  @Matches(/^\d{10}(-\d{3})?$/, {
    message:
      'Mã số thuế phải gồm 10 chữ số (hoặc 10 số kèm -xxx cho chi nhánh)',
  })
  taxCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Nội dung vượt giới hạn 1000 ký tự' })
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Nội dung vượt giới hạn 200 ký tự' })
  legalRep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Nội dung vượt giới hạn 100 ký tự' })
  businessType?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(TaxPeriod, { message: 'Kỳ khai thuế không hợp lệ' })
  taxPeriod?: TaxPeriod;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(CustomerStatus, { message: 'Trạng thái không hợp lệ' })
  status?: CustomerStatus;

  /** Trường thuế–kế toán dùng sinh lịch báo cáo (06, I5). */
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt({ message: 'Tháng kết thúc năm tài chính phải từ 1 đến 12' })
  @Min(1, { message: 'Tháng kết thúc năm tài chính phải từ 1 đến 12' })
  @Max(12, { message: 'Tháng kết thúc năm tài chính phải từ 1 đến 12' })
  fiscalYearEndMonth?: number;

  @IsOptional()
  @IsEnum(VatMethod, { message: 'Phương pháp tính thuế GTGT không hợp lệ' })
  vatMethod?: VatMethod | null;

  @IsOptional()
  @IsEnum(PitPeriod, { message: 'Kỳ khai TNCN không hợp lệ' })
  pitPeriod?: PitPeriod | null;

  @IsOptional()
  @IsEnum(AccountingRegime, { message: 'Chế độ kế toán không hợp lệ' })
  accountingRegime?: AccountingRegime | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200, { message: 'Nội dung vượt giới hạn 200 ký tự' })
  taxAuthority?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Nội dung vượt giới hạn 200 ký tự' })
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Nội dung vượt giới hạn 30 ký tự' })
  contactPhone?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @IsEmail({}, { message: 'Email liên hệ không hợp lệ' })
  @MaxLength(254, { message: 'Nội dung vượt giới hạn 254 ký tự' })
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Nội dung vượt giới hạn 2000 ký tự' })
  note?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Người phụ trách không hợp lệ' })
  ownerId?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto, {
  skipNullProperties: false,
}) {}

export class CustomerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
