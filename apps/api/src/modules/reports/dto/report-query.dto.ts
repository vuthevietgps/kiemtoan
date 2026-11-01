import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  REVENUE_GROUPS as MEASURE_GROUPS,
  type RevenueGroup,
} from '../utils/revenue-measures';

/** Tham số chung: `?format=csv` để tải file; `token` cho link tải trực tiếp. */
export class ReportExportQueryDto {
  @ApiPropertyOptional({ enum: ['json', 'csv'] })
  @IsOptional()
  @IsIn(['json', 'csv'], { message: 'Định dạng không hợp lệ' })
  format?: 'json' | 'csv';

  @ApiPropertyOptional({ description: 'Token đăng nhập khi tải qua link' })
  @IsOptional()
  @IsString()
  token?: string;
}

export class ReportPeriodQueryDto extends ReportExportQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  to?: string;
}

/** Báo cáo vận hành 10-C: kỳ + lọc một khách hàng. */
export class OperationsReportQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { message: 'Khách hàng không hợp lệ' })
  customerId?: string;
}

/** Báo cáo Doanh thu 10-D (M4): kỳ, nhóm, lọc KH; `format=csv` giữ cho link tải trực tiếp. */
export class RevenueMeasuresQueryDto extends ReportPeriodQueryDto {
  @ApiPropertyOptional({ enum: MEASURE_GROUPS, default: 'serviceType' })
  @IsOptional()
  @IsIn(MEASURE_GROUPS, { message: 'Kiểu nhóm không hợp lệ' })
  groupBy?: RevenueGroup;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { message: 'Khách hàng không hợp lệ' })
  customerId?: string;
}

export const CAPABILITY_ROLES = ['ASSISTANT', 'LEAD', 'MANAGER'] as const;
export const CAPABILITY_DOMAINS = ['ACCOUNTING', 'AUDIT', 'ALL'] as const;

/** Đánh giá năng lực 10-E: kỳ, vai (tab), mảng, nhóm. */
export class CapabilityQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  to?: string;

  @ApiPropertyOptional({ enum: CAPABILITY_ROLES })
  @IsOptional()
  @IsIn(CAPABILITY_ROLES, { message: 'Vai không hợp lệ' })
  role?: (typeof CAPABILITY_ROLES)[number];

  @ApiPropertyOptional({ enum: CAPABILITY_DOMAINS })
  @IsOptional()
  @IsIn(CAPABILITY_DOMAINS, { message: 'Mảng không hợp lệ' })
  domain?: (typeof CAPABILITY_DOMAINS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { message: 'Nhóm không hợp lệ' })
  teamId?: string;
}
