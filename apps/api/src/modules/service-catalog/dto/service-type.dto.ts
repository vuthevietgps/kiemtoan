import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BillingCycle, PricingBasis } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsMoney } from '../../contracts/dto/money.decorator';

export class CreateServiceTypeDto {
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mã dịch vụ' })
  code: string;

  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên dịch vụ' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(BillingCycle, { message: 'Chu kỳ không hợp lệ' })
  cycle: BillingCycle;

  @IsOptional()
  @IsMoney('Giá chuẩn không hợp lệ')
  defaultPrice?: string;

  @ApiPropertyOptional({ enum: PricingBasis })
  @IsOptional()
  @IsEnum(PricingBasis, { message: 'Tiêu chí bảng giá không hợp lệ' })
  pricingBasis?: PricingBasis;

  @ApiPropertyOptional({
    description: 'Đơn vị của tiêu chí, ví dụ "chứng từ/tháng"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Đơn vị tiêu chí tối đa 50 ký tự' })
  pricingUnit?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Dịch vụ phát hành báo cáo kiểm toán (theo dõi ở 04-F)',
  })
  @IsOptional()
  @IsBoolean()
  issuesAuditReport?: boolean;
}

export class UpdateServiceTypeDto extends PartialType(CreateServiceTypeDto) {}

export class ServiceTypeQueryDto {
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Lọc dịch vụ đang dùng / ngừng',
  })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'Bộ lọc trạng thái không hợp lệ' })
  active?: 'true' | 'false';

  @ApiPropertyOptional({ description: 'Tìm theo mã hoặc tên' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
