import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsMoney } from '../../contracts/dto/money.decorator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Một bậc giá: áp dụng khi minValue ≤ giá trị < maxValue (maxValue trống = không giới hạn). */
export class PriceTierDto {
  @IsMoney('Giá trị "từ" không hợp lệ')
  minValue: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsMoney('Giá trị "đến" không hợp lệ')
  maxValue?: string | null;

  @IsMoney('Đơn giá không hợp lệ')
  unitPrice: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Ghi chú bậc giá tối đa 500 ký tự' })
  note?: string | null;
}

export class PriceListDto {
  @ApiPropertyOptional({ example: '2026-11-01' })
  @Matches(DATE_PATTERN, { message: 'Ngày hiệu lực phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'Ngày hiệu lực không hợp lệ' })
  effectiveFrom: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú tối đa 1.000 ký tự' })
  note?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Bảng giá cần ít nhất một bậc' })
  @ArrayMaxSize(50, { message: 'Bảng giá tối đa 50 bậc' })
  @ValidateNested({ each: true })
  @Type(() => PriceTierDto)
  tiers: PriceTierDto[];
}

export class PriceQuoteQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Giá trị theo tiêu chí của bảng giá',
  })
  @IsOptional()
  @IsMoney('Giá trị theo tiêu chí không hợp lệ')
  value?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Mặc định hôm nay',
  })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'Ngày không hợp lệ' })
  date?: string;
}
