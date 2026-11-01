import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

/** Khoảng ngày xem tổng quan; bỏ trống = tháng hiện tại. */
export class DashboardQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  to?: string;
}

/** Danh sách dịch vụ của thẻ "Dịch vụ hoàn thành" (10, M3). */
export class ServiceListQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({ enum: ['done', 'open'] })
  @IsOptional()
  @IsIn(['done', 'open'])
  state?: 'done' | 'open';
}
