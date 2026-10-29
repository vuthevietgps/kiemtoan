import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}(-(0[1-9]|1[0-2])|-Q[1-4])?$/;

export class CreatePlanDto {
  @ApiPropertyOptional({
    description: 'Mặc định: phiên bản đang hiệu lực của quy trình mặc định',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Phiên bản quy trình không hợp lệ' })
  workflowVersionId?: string;

  @IsOptional()
  @Matches(DATE, { message: 'Ngày bắt đầu phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string;

  @IsOptional()
  @Matches(PERIOD, { message: 'Kỳ phải có dạng YYYY, YYYY-MM hoặc YYYY-Qn' })
  period?: string;
}

export class PlanStepChangeDto {
  @IsString()
  @MaxLength(20)
  stepKey: string;

  @IsOptional()
  @IsBoolean()
  skipped?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'Người thực hiện không hợp lệ' })
  assigneeId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Người kiểm tra không hợp lệ' })
  reviewerId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Người phê duyệt không hợp lệ' })
  approverId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Thời lượng từ 1 đến 365 ngày' })
  @Max(365, { message: 'Thời lượng từ 1 đến 365 ngày' })
  durationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(-365)
  @Max(365)
  dueOffsetDays?: number;
}

/** Xem trước lịch với thay đổi chưa lưu. */
export class PreviewPlanDto {
  @IsOptional()
  @Matches(DATE, { message: 'Ngày bắt đầu phải có dạng YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string;

  @IsOptional()
  @Matches(PERIOD, { message: 'Kỳ phải có dạng YYYY, YYYY-MM hoặc YYYY-Qn' })
  period?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlanStepChangeDto)
  steps: PlanStepChangeDto[];
}

export class UpdatePlanDto extends PreviewPlanDto {
  @IsInt()
  @Min(1)
  revision: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
