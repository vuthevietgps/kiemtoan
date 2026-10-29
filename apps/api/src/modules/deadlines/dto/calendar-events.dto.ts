import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

const DATE = { message: 'Ngày không hợp lệ (YYYY-MM-DD)' };

/** Loại hạn trên lịch (I14): pháp lý = lịch báo cáo của KH; nội bộ = hạn hiện hành của việc. */
export const CALENDAR_KINDS = ['STATUTORY', 'INTERNAL'] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];

/** Trạng thái gộp cho cả việc và nghĩa vụ: chưa xong / quá hạn chưa xong / đã xong (đã nộp). */
export const CALENDAR_STATUSES = ['OPEN', 'OVERDUE', 'DONE'] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export class CalendarEventsQueryDto {
  @IsDateString({ strict: true }, DATE)
  from: string;

  @IsDateString({ strict: true }, DATE)
  to: string;

  @IsOptional()
  @IsUUID('all', { message: 'Khách hàng không hợp lệ' })
  customerId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Nhân viên không hợp lệ' })
  userId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Loại nghĩa vụ không hợp lệ' })
  obligationTypeId?: string;

  @ApiPropertyOptional({ enum: CALENDAR_KINDS })
  @IsOptional()
  @IsIn(CALENDAR_KINDS, { message: 'Loại hạn không hợp lệ' })
  kind?: CalendarKind;

  @ApiPropertyOptional({ enum: CALENDAR_STATUSES })
  @IsOptional()
  @IsIn(CALENDAR_STATUSES, { message: 'Trạng thái không hợp lệ' })
  status?: CalendarStatus;
}
