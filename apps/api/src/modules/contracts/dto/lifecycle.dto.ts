import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Thông tin không ảnh hưởng tiền, sửa được cả sau khi HĐ đã duyệt (E6), có audit. */
export class BusinessInfoDto {
  @IsOptional()
  @IsUUID('all', { message: 'Người phụ trách không hợp lệ' })
  ownerId?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'Người phụ trách kinh doanh không hợp lệ' })
  salesOwnerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referrerName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  referrerPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  referrerNote?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày ký không hợp lệ' })
  signedDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string | null;
}

export class ExpiringQueryDto {
  /** Số ngày tới; mặc định 30 (11 sẽ đưa vào Cài đặt). */
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class RenewalStatsQueryDto {
  @IsDateString({}, { message: 'Từ ngày không hợp lệ' })
  from: string;

  @IsDateString({}, { message: 'Đến ngày không hợp lệ' })
  to: string;
}
