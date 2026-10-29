import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskReviewDecision, TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** 'true' / 'false' trên query string → boolean. */
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;

/** OPEN = chưa Hoàn thành (mọi trạng thái còn phải làm). */
export const TASK_STATUS_FILTERS = [
  ...Object.values(TaskStatus),
  'OPEN',
] as const;
export type TaskStatusFilter = (typeof TASK_STATUS_FILTERS)[number];

export const DUE_FILTERS = ['overdue', 'today', 'week', 'month'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export class TaskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TASK_STATUS_FILTERS })
  @IsOptional()
  @IsIn(TASK_STATUS_FILTERS, { message: 'Trạng thái không hợp lệ' })
  status?: TaskStatusFilter;

  @IsOptional()
  @IsUUID('all', { message: 'Khách hàng không hợp lệ' })
  customerId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Hợp đồng không hợp lệ' })
  contractId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Dòng dịch vụ không hợp lệ' })
  contractServiceId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Nhân viên không hợp lệ' })
  assigneeId?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ enum: DUE_FILTERS })
  @IsOptional()
  @IsIn(DUE_FILTERS, { message: 'Bộ lọc hạn không hợp lệ' })
  due?: DueFilter;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  missingEvidence?: boolean;

  /** Việc hoàn thành trong tháng này (khớp ô "Đã làm tháng này"). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  completedThisMonth?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;

  /** Người kiểm tra hoặc người phê duyệt (05-E). */
  @IsOptional()
  @IsUUID('all', { message: 'Người kiểm tra không hợp lệ' })
  reviewerId?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Mức ưu tiên không hợp lệ' })
  priority?: TaskPriority;

  /** Chỉ việc có hạn pháp lý. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  statutory?: boolean;
}

/** Việc của tôi (05-E, H11): 4 tab. */
export const MY_TABS = ['today', 'upcoming', 'overdue', 'done'] as const;
export type MyTab = (typeof MY_TABS)[number];

export class MyTasksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MY_TABS })
  @IsOptional()
  @IsIn(MY_TABS, { message: 'Tab không hợp lệ' })
  tab?: MyTab;
}

/** Bình luận trên việc (không @nhắc tên). */
export class TaskCommentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập nội dung bình luận' })
  @MaxLength(2000, { message: 'Bình luận tối đa 2000 ký tự' })
  content: string;
}

/** Giao lại hàng loạt (người quản lý việc). */
export class BulkReassignDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Chọn ít nhất một việc' })
  @ArrayMaxSize(200, { message: 'Tối đa 200 việc mỗi lần' })
  @IsUUID('all', { each: true, message: 'Việc không hợp lệ' })
  taskIds: string[];

  @IsUUID('all', { message: 'Người làm không hợp lệ' })
  assigneeId: string;
}

export class TaskSummaryQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;
}

export class CalendarQueryDto {
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from: string;

  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  to: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;
}

export class CreateTaskDto {
  @IsUUID('all', { message: 'Vui lòng chọn khách hàng' })
  customerId: string;

  @IsOptional()
  @IsUUID('all', { message: 'Hợp đồng không hợp lệ' })
  contractId?: string;

  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên công việc' })
  @MaxLength(300)
  title: string;

  @IsDateString({}, { message: 'Hạn hoàn thành không hợp lệ' })
  dueDate: string;

  @IsOptional()
  @IsUUID('all', { message: 'Người làm không hợp lệ' })
  assigneeId?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsBoolean()
  requiresEvidence?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDelivery?: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Mức ưu tiên không hợp lệ' })
  priority?: TaskPriority;

  /** Số cấp soát xét 0/1/2 (H2); mặc định 0. */
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Số cấp duyệt từ 0 đến 2' })
  @Max(2, { message: 'Số cấp duyệt từ 0 đến 2' })
  reviewLevels?: number;

  @IsOptional()
  @IsUUID('all', { message: 'Người kiểm tra không hợp lệ' })
  reviewerId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Người phê duyệt không hợp lệ' })
  approverId?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên công việc' })
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Hạn hoàn thành không hợp lệ' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** null = bỏ giao việc. Chỉ người quản lý việc được đổi (kể cả ba trường dưới). */
  @IsOptional()
  @IsUUID('all', { message: 'Người làm không hợp lệ' })
  assigneeId?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'Người kiểm tra không hợp lệ' })
  reviewerId?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'Người phê duyệt không hợp lệ' })
  approverId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Số cấp duyệt từ 0 đến 2' })
  @Max(2, { message: 'Số cấp duyệt từ 0 đến 2' })
  reviewLevels?: number;

  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Mức ưu tiên không hợp lệ' })
  priority?: TaskPriority;

  /** Tỷ lệ % người làm tự nhập, chỉ tham khảo (H10). */
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Tỷ lệ hoàn thành từ 0 đến 100' })
  @Max(100, { message: 'Tỷ lệ hoàn thành từ 0 đến 100' })
  progress?: number;
}

/** Ghi chú kèm thao tác: kết quả hoàn thành/giao nộp. */
export class TaskNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Nội dung tối đa 2000 ký tự' })
  note?: string;
}

/** Kiểm tra/phê duyệt cấp hiện tại: chấp nhận hoặc trả lại (bắt buộc nội dung). */
export class ReviewTaskDto extends TaskNoteDto {
  @IsEnum(TaskReviewDecision, { message: 'Quyết định không hợp lệ' })
  decision: TaskReviewDecision;
}

export class EvidenceDto {
  @IsOptional()
  @IsString()
  note?: string;
}
