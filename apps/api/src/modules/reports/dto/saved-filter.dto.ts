import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportScheduleFrequency } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { REPORT_KEYS, type ReportKey } from '../report-exporter.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SavedFilterQueryDto {
  @ApiPropertyOptional({ enum: REPORT_KEYS })
  @IsOptional()
  @IsIn(REPORT_KEYS, { message: 'Báo cáo không hợp lệ' })
  report?: ReportKey;
}

export class CreateSavedFilterDto {
  @ApiProperty({ enum: REPORT_KEYS })
  @IsIn(REPORT_KEYS, { message: 'Báo cáo không hợp lệ' })
  report!: ReportKey;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên bộ lọc' })
  @MaxLength(100, { message: 'Tên bộ lọc tối đa 100 ký tự' })
  name!: string;

  @ApiProperty({ type: Object })
  @IsObject({ message: 'Tham số không hợp lệ' })
  params!: Record<string, unknown>;
}

export class UpdateSavedFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên bộ lọc' })
  @MaxLength(100, { message: 'Tên bộ lọc tối đa 100 ký tự' })
  name?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject({ message: 'Tham số không hợp lệ' })
  params?: Record<string, unknown>;
}

export class SaveScheduleDto {
  @ApiProperty({ enum: ReportScheduleFrequency })
  @IsEnum(ReportScheduleFrequency, { message: 'Tần suất không hợp lệ' })
  frequency!: ReportScheduleFrequency;

  @ApiProperty()
  @IsBoolean({ message: 'Trạng thái không hợp lệ' })
  enabled!: boolean;
}

/** Tải Excel của bộ lọc đã lưu: mặc định theo kỳ lưu; link trong thông báo định kỳ truyền kỳ của lượt gửi. */
export class SavedFilterExportQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  to?: string;
}
