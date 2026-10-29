import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CalendarDayKind,
  HolidayShift,
  ObligationCycle,
  ObligationDueRule,
  ObligationGroup,
  ObligationStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const DATE = { message: 'Ngày không hợp lệ (YYYY-MM-DD)' };

export class CalendarDayDto {
  @IsDateString({ strict: true }, DATE)
  date: string;

  @IsEnum(CalendarDayKind, { message: 'Loại ngày không hợp lệ' })
  kind: CalendarDayKind;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên ngày (ví dụ "Quốc khánh")' })
  @MaxLength(200, { message: 'Tên ngày tối đa 200 ký tự' })
  name: string;
}

/** Ghi lại toàn bộ ngày nghỉ/làm bù của một năm (I2). */
export class SaveCalendarDaysDto {
  /** Bỏ trống khi năm chưa có lịch. */
  @IsOptional()
  @IsInt()
  @Min(1)
  revision?: number;

  @IsArray()
  @ArrayMaxSize(120, { message: 'Tối đa 120 ngày mỗi năm' })
  @ValidateNested({ each: true })
  @Type(() => CalendarDayDto)
  days: CalendarDayDto[];

  /** Bắt buộc khi sửa năm đã xác nhận. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Lý do từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do từ 5 đến 500 ký tự' })
  reason?: string;
}

export class RevisionDto {
  @IsInt({ message: 'Thiếu phiên bản dữ liệu (revision)' })
  @Min(1)
  revision: number;
}

export class ReasonDto {
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Lý do từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do từ 5 đến 500 ký tự' })
  reason: string;
}

/** Quy tắc hạn của một phiên bản loại nghĩa vụ (I1, I3). */
export class ObligationVersionDto {
  @IsDateString({ strict: true }, DATE)
  effectiveFrom: string;

  @IsEnum(ObligationDueRule, { message: 'Cách tính hạn không hợp lệ' })
  dueRule: ObligationDueRule;

  @IsOptional()
  @IsInt({ message: 'Số tháng sau cuối kỳ phải là số nguyên' })
  monthsAfter?: number | null;

  @IsOptional()
  @IsInt({ message: 'Tháng hạn phải là số nguyên' })
  dueMonth?: number | null;

  @IsInt({ message: 'Ngày hạn phải là số nguyên' })
  dueDay: number;

  @IsOptional()
  @IsBoolean()
  useFiscalYear?: boolean;

  @IsOptional()
  @IsEnum(HolidayShift, { message: 'Cách dời ngày nghỉ không hợp lệ' })
  holidayShift?: HolidayShift;

  /** { taxPeriod?, vatMethod?, pitPeriod?, accountingRegime? } — mảng giá trị cho phép. */
  @IsOptional()
  @IsObject({ message: 'Điều kiện áp dụng không hợp lệ' })
  conditions?: Record<string, unknown>;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'Căn cứ pháp lý tối đa 1000 ký tự' })
  legalBasis?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú tối đa 1000 ký tự' })
  note?: string | null;
}

export class SaveObligationDraftDto extends ObligationVersionDto {
  /** Bắt buộc khi sửa bản nháp đang có. */
  @IsOptional()
  @IsInt()
  @Min(1)
  revision?: number;
}

export class CreateObligationTypeDto extends ObligationVersionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9_-]{2,30}$/, {
    message: 'Mã gồm 2–30 ký tự chữ in hoa, số, "-" hoặc "_"',
  })
  code: string;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên loại nghĩa vụ' })
  @MaxLength(200, { message: 'Tên tối đa 200 ký tự' })
  name: string;

  @IsOptional()
  @IsEnum(ObligationGroup, { message: 'Nhóm nghĩa vụ không hợp lệ' })
  group?: ObligationGroup;

  /** Nhóm thay thế (ví dụ GTGT tháng/quý cùng "GTGT"); mặc định = mã. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9_-]{2,30}$/, { message: 'Nhóm thay thế không hợp lệ' })
  family?: string;

  @IsEnum(ObligationCycle, { message: 'Chu kỳ không hợp lệ' })
  cycle: ObligationCycle;
}

export class UpdateObligationTypeDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên loại nghĩa vụ' })
  @MaxLength(200, { message: 'Tên tối đa 200 ký tự' })
  name?: string;

  @IsOptional()
  @IsEnum(ObligationGroup, { message: 'Nhóm nghĩa vụ không hợp lệ' })
  group?: ObligationGroup;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9_-]{2,30}$/, { message: 'Nhóm thay thế không hợp lệ' })
  family?: string;
}

export class SetObligationServicesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true, message: 'Dịch vụ không hợp lệ' })
  serviceTypeIds: string[];
}

export class ObligationPreviewQueryDto {
  @IsUUID('all', { message: 'Khách hàng không hợp lệ' })
  customerId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  periods?: number;
}

/** Trạng thái hiển thị: thêm OVERDUE = Trễ hạn (chưa nộp, quá hạn theo giờ VN). */
export const OBLIGATION_FILTERS = [
  ...Object.values(ObligationStatus),
  'OVERDUE',
] as const;
export type ObligationFilter = (typeof OBLIGATION_FILTERS)[number];

export class ObligationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all')
  customerId?: string;

  @IsOptional()
  @IsUUID('all')
  obligationTypeId?: string;

  /** Người phụ trách KH (06-D2). */
  @IsOptional()
  @IsUUID('all', { message: 'Người phụ trách không hợp lệ' })
  ownerId?: string;

  @ApiPropertyOptional({ enum: OBLIGATION_FILTERS })
  @IsOptional()
  @IsIn(OBLIGATION_FILTERS, { message: 'Trạng thái không hợp lệ' })
  status?: ObligationFilter;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  period?: string;

  @IsOptional()
  @IsDateString({ strict: true }, DATE)
  dueFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true }, DATE)
  dueTo?: string;
}

/** Ô đếm Lịch báo cáo: cùng bộ lọc KH/loại/người phụ trách/tìm kiếm, không phân trang. */
export class ObligationSummaryQueryDto {
  @IsOptional()
  @IsUUID('all')
  customerId?: string;

  @IsOptional()
  @IsUUID('all')
  obligationTypeId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Người phụ trách không hợp lệ' })
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class ObligationActionDto extends RevisionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú tối đa 1000 ký tự' })
  note?: string;
}

/** Đánh dấu Đã nộp (multipart: file biên nhận bắt buộc — I7). */
export class FileObligationDto {
  @Type(() => Number)
  @IsInt({ message: 'Thiếu phiên bản dữ liệu (revision)' })
  @Min(1)
  revision: number;

  @IsDateString({ strict: true }, { message: 'Ngày nộp không hợp lệ' })
  filedAt: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú tối đa 1000 ký tự' })
  note?: string;
}

export class ObligationReasonDto extends RevisionDto {
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Lý do từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do từ 5 đến 500 ký tự' })
  reason: string;
}

export class ObligationSettingDto extends ReasonDto {
  @IsBoolean({ message: 'Chọn bật hoặc tắt' })
  enabled: boolean;
}
