import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentCategory, Role, WorkflowScheduleMode } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
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
import {
  MAX_DEPENDENCIES,
  MAX_REQUIREMENTS,
  MAX_STEPS,
} from '../workflow.util';

const STEP_KEY = /^[A-Z0-9_-]{1,20}$/;
const STEP_KEY_MESSAGE =
  'Khoá bước chỉ gồm chữ in hoa, số, "-" hoặc "_" (tối đa 20 ký tự)';
/** Vai trò nghiệp vụ được chọn làm người thực hiện/kiểm tra mặc định. */
export const WORKFLOW_ROLES = [Role.STAFF, Role.MANAGER, Role.DIRECTOR];
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class WorkflowStepDto {
  @Matches(STEP_KEY, { message: STEP_KEY_MESSAGE })
  key: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Tên giai đoạn tối đa 100 ký tự' })
  phase?: string | null;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Tên bước từ 2 đến 200 ký tự' })
  @MaxLength(200, { message: 'Tên bước từ 2 đến 200 ký tự' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Hướng dẫn tối đa 2.000 ký tự' })
  instructions?: string | null;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    description: 'Số ngày làm việc (lập lịch theo dự án)',
  })
  @IsOptional()
  @IsInt({ message: 'Thời lượng phải là số nguyên' })
  @Min(1, { message: 'Thời lượng từ 1 đến 365 ngày' })
  @Max(365, { message: 'Thời lượng từ 1 đến 365 ngày' })
  durationDays?: number | null;

  @ApiPropertyOptional({
    description: 'Số ngày sau cuối kỳ (lập lịch theo kỳ)',
  })
  @IsOptional()
  @IsInt({ message: 'Số ngày lệch phải là số nguyên' })
  @Min(-365)
  @Max(365)
  dueOffsetDays?: number | null;

  @IsOptional()
  @IsIn(WORKFLOW_ROLES, { message: 'Vai trò thực hiện không hợp lệ' })
  performerRole?: Role | null;

  @IsOptional()
  @IsUUID('4', { message: 'Người thực hiện mặc định không hợp lệ' })
  defaultAssigneeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Số cấp duyệt từ 0 đến 2' })
  @Max(2, { message: 'Số cấp duyệt từ 0 đến 2' })
  reviewLevels?: number;

  @IsOptional()
  @IsIn(WORKFLOW_ROLES, { message: 'Vai trò người kiểm tra không hợp lệ' })
  reviewerRole?: Role | null;

  @IsOptional()
  @IsUUID('4', { message: 'Người kiểm tra mặc định không hợp lệ' })
  defaultReviewerId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Người phê duyệt mặc định không hợp lệ' })
  defaultApproverId?: string | null;

  @IsOptional()
  @IsBoolean()
  requiresEvidence?: boolean;

  /** Hạn của bước là hạn pháp lý (G6). */
  @IsOptional()
  @IsBoolean()
  isStatutory?: boolean;

  /** Cần xác nhận giao nộp sau phê duyệt (H1); mặc định bật cho bước có hạn pháp lý. */
  @IsOptional()
  @IsBoolean()
  requiresDelivery?: boolean;

  /** Loại nghĩa vụ của bước pháp lý (06, I6): hạn việc lấy theo lịch báo cáo của khách hàng. */
  @IsOptional()
  @IsUUID('all', { message: 'Loại nghĩa vụ không hợp lệ' })
  obligationTypeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Gợi ý bằng chứng tối đa 200 ký tự' })
  evidenceHint?: string | null;

  @IsArray()
  @ArrayMaxSize(MAX_DEPENDENCIES)
  @Matches(STEP_KEY, { each: true, message: STEP_KEY_MESSAGE })
  dependsOn: string[];
}

/** Hồ sơ cần khách hàng cung cấp cho dịch vụ (đặc tả 03-C). */
export class DocumentRequirementDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Tên hồ sơ từ 2 đến 200 ký tự' })
  @MaxLength(200, { message: 'Tên hồ sơ từ 2 đến 200 ký tự' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Hướng dẫn hồ sơ tối đa 1.000 ký tự' })
  instructions?: string | null;

  @ApiPropertyOptional({ description: 'false = hồ sơ "nếu có"' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsEnum(DocumentCategory, { message: 'Nhóm hồ sơ không hợp lệ' })
  category?: DocumentCategory;

  @ApiPropertyOptional({
    description: 'true = thu theo từng kỳ; false = một lần',
  })
  @IsOptional()
  @IsBoolean()
  perPeriod?: boolean;

  @ApiPropertyOptional({
    description: 'Khoá bước cần hồ sơ này (cùng phiên bản)',
  })
  @IsOptional()
  @Matches(STEP_KEY, { message: STEP_KEY_MESSAGE })
  stepKey?: string | null;
}

export class SaveWorkflowVersionDto {
  @ApiPropertyOptional({ description: 'Revision đang xem, để chống ghi đè' })
  @IsInt()
  @Min(1)
  revision: number;

  @IsEnum(WorkflowScheduleMode, { message: 'Cách lập lịch không hợp lệ' })
  scheduleMode: WorkflowScheduleMode;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú tối đa 1.000 ký tự' })
  note?: string | null;

  @IsArray()
  @ArrayMaxSize(MAX_STEPS, { message: `Phiên bản tối đa ${MAX_STEPS} bước` })
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps: WorkflowStepDto[];

  @ApiPropertyOptional({
    description:
      'Danh sách hồ sơ yêu cầu; không gửi = giữ nguyên danh sách hiện có',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REQUIREMENTS, {
    message: `Phiên bản tối đa ${MAX_REQUIREMENTS} hồ sơ yêu cầu`,
  })
  @ValidateNested({ each: true })
  @Type(() => DocumentRequirementDto)
  requirements?: DocumentRequirementDto[];
}

export class CreateWorkflowTemplateDto {
  @IsUUID('4', { message: 'Dịch vụ không hợp lệ' })
  serviceTypeId: string;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Tên quy trình từ 2 đến 200 ký tự' })
  @MaxLength(200, { message: 'Tên quy trình từ 2 đến 200 ký tự' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class UpdateWorkflowTemplateDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Tên quy trình từ 2 đến 200 ký tự' })
  @MaxLength(200, { message: 'Tên quy trình từ 2 đến 200 ký tự' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Chỉ nhận true: đặt làm quy trình mặc định',
  })
  @IsOptional()
  @IsIn([true], { message: 'Chỉ có thể đặt một quy trình khác làm mặc định' })
  isDefault?: boolean;
}

export class CloneWorkflowVersionDto {
  @ApiPropertyOptional({
    description: 'Có giá trị: tạo quy trình mới cho dịch vụ này',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Dịch vụ không hợp lệ' })
  serviceTypeId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Tên quy trình từ 2 đến 200 ký tự' })
  @MaxLength(200)
  name?: string;
}

export class WorkflowTemplateQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Dịch vụ không hợp lệ' })
  serviceTypeId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false'])
  hasDraft?: 'true' | 'false';
}

export class WorkflowPreviewQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày bắt đầu phải có dạng YYYY-MM-DD',
  })
  @IsDateString({ strict: true }, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}(-(0[1-9]|1[0-2])|-Q[1-4])?$/, {
    message: 'Kỳ phải có dạng YYYY, YYYY-MM hoặc YYYY-Qn',
  })
  period?: string;
}
