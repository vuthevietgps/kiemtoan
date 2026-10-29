import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import {
  REVENUE_GROUPS,
  type RevenueGroupBy,
} from '../utils/report-grouping.util';

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

export class RevenueReportQueryDto extends ReportPeriodQueryDto {
  @ApiPropertyOptional({ enum: REVENUE_GROUPS, default: 'serviceType' })
  @IsOptional()
  @IsIn(REVENUE_GROUPS, { message: 'Kiểu nhóm không hợp lệ' })
  groupBy: RevenueGroupBy = 'serviceType';
}
