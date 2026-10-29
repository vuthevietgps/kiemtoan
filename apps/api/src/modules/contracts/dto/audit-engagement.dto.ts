import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  AcceptanceStatus,
  AuditDeadlineKind,
  AuditStage,
  ClientDeliveryStatus,
  OriginalFilingStatus,
  TaskPriority,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
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
} from 'class-validator';
import { MAX_ASSISTANTS } from '../audit-engagements/audit-engagement.rules';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD';
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

/** `revision` đọc từ GET; 0 khi hồ sơ chưa được lưu lần nào. */
class RevisionDto {
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt({ message: 'Phiên bản hồ sơ không hợp lệ' })
  @Min(0)
  revision: number;
}

/** Nhóm kiểm toán và người ký (thay cả đội hình; bỏ trống = không có). */
export class SaveAuditEngagementDto extends RevisionDto {
  @IsOptional()
  @IsUUID('all', { message: 'Manager không hợp lệ' })
  managerId?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'Trưởng nhóm không hợp lệ' })
  leadId?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'Người ký 1 không hợp lệ' })
  signer1Id?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'Người ký 2 không hợp lệ' })
  signer2Id?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ASSISTANTS, {
    message: `Tối đa ${MAX_ASSISTANTS} trợ lý`,
  })
  @IsUUID('all', { each: true, message: 'Trợ lý không hợp lệ' })
  assistantIds?: string[];

  /** Hạn dự kiến (04-F2): bỏ trống = giữ nguyên, null = bỏ hạn; chỉ sửa được trước khi chốt. */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  fieldworkDue?: string | null;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  reviewDue?: string | null;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  issueDue?: string | null;
}

/** Gia hạn sau khi đã chốt (F9): hạn mới và lý do. */
export class ExtendAuditDeadlineDto extends RevisionDto {
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  due: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}

export class ChangeAuditStageDto extends RevisionDto {
  @IsEnum(AuditStage, { message: 'Giai đoạn không hợp lệ' })
  stage: AuditStage;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** Gửi multipart (kèm file BCKT tuỳ chọn) nên mọi trường là chuỗi. */
export class IssueAuditReportDto extends RevisionDto {
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập số báo cáo kiểm toán' })
  @MaxLength(100, { message: 'Số báo cáo tối đa 100 ký tự' })
  reportNumber: string;

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  reportDate: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID('all', { message: 'Người ký 1 không hợp lệ' })
  signer1Id?: string;
}

export class ReopenAuditReportDto extends RevisionDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

/** Tình trạng hồ sơ HĐ: gửi khách, lưu bản gốc, BBNT (thay toàn bộ). */
export class ContractDossierDto extends RevisionDto {
  @IsEnum(ClientDeliveryStatus, { message: 'Tình trạng gửi HĐ không hợp lệ' })
  clientDeliveryStatus: ClientDeliveryStatus;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  clientDeliveredAt?: string | null;

  @IsEnum(OriginalFilingStatus, {
    message: 'Tình trạng lưu bản gốc không hợp lệ',
  })
  originalFilingStatus: OriginalFilingStatus;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  originalFiledAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Ghi chú vị trí lưu tối đa 200 ký tự' })
  originalFilingNote?: string | null;

  @IsEnum(AcceptanceStatus, { message: 'Tình trạng BBNT không hợp lệ' })
  acceptanceStatus: AcceptanceStatus;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  acceptanceSignedAt?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'Bản BBNT đã ký không hợp lệ' })
  acceptanceDocumentId?: string | null;
}

/** Tab Theo nhân sự (04-F2): mặc định năm nay; hạn thuộc kỳ khi hạn hiện hành nằm trong khoảng. */
export class AuditPeopleQueryDto {
  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  to?: string;

  @ApiPropertyOptional({ enum: ['MANAGER', 'LEAD', 'SIGNER1'] })
  @IsOptional()
  @IsIn(['MANAGER', 'LEAD', 'SIGNER1'], { message: 'Vai không hợp lệ' })
  role?: 'MANAGER' | 'LEAD' | 'SIGNER1';

  @IsOptional()
  @IsEnum(AuditDeadlineKind, { message: 'Loại hạn không hợp lệ' })
  kind?: AuditDeadlineKind;

  @IsOptional()
  @IsUUID('all', { message: 'Dịch vụ không hợp lệ' })
  serviceTypeId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Nhóm không hợp lệ' })
  teamId?: string;
}

export const BOARD_SORTS = [
  'priority',
  'signedDate',
  'code',
  'stage',
  'issueDue',
  'reportDate',
] as const;
export const DEADLINE_FILTERS = [
  'OVERDUE',
  'DUE_SOON',
  'LATE',
  'EXTENDED',
] as const;
const toBool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/** Bảng theo dõi HĐ kiểm toán (04-F3): mỗi dòng là một hồ sơ kiểm toán. */
export class AuditBoardQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 50;

  @ApiPropertyOptional({ description: 'Tên KH, MST, số HĐ, số BCKT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsUUID('all')
  serviceTypeId?: string;

  @IsOptional()
  @IsEnum(AuditStage, { message: 'Giai đoạn không hợp lệ' })
  stage?: AuditStage;

  @IsOptional()
  @IsUUID('all')
  ownerId?: string;

  @IsOptional()
  @IsUUID('all')
  managerId?: string;

  @IsOptional()
  @IsUUID('all')
  leadId?: string;

  @IsOptional()
  @IsUUID('all')
  signerId?: string;

  @IsOptional()
  @IsIn(DEADLINE_FILTERS, { message: 'Tình trạng hạn không hợp lệ' })
  deadline?: (typeof DEADLINE_FILTERS)[number];

  @ApiPropertyOptional({
    description: 'Hồ sơ HĐ chưa đủ (chưa gửi / chưa lưu / chưa có BBNT)',
  })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  dossierIncomplete?: boolean;

  @ApiPropertyOptional({ description: 'Đã phát hành nhưng chưa có hoá đơn' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  uninvoiced?: boolean;

  @ApiPropertyOptional({ description: 'Còn phải thu (cần quyền tài chính)' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  receivable?: boolean;

  @ApiPropertyOptional({ enum: TaskPriority, description: 'Mức độ (04-F4)' })
  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Mức độ không hợp lệ' })
  priority?: TaskPriority;

  @IsOptional()
  @IsIn(BOARD_SORTS)
  sort?: (typeof BOARD_SORTS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

/** Mức độ của hồ sơ kiểm toán (04-F4). */
export class AuditPriorityDto {
  @IsEnum(TaskPriority, { message: 'Mức độ không hợp lệ' })
  priority: TaskPriority;
}

/** Một dòng báo cáo tình hình cụ thể (04-F4). */
export class AuditNoteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Nội dung tình hình từ 2 đến 2000 ký tự' })
  @MaxLength(2000, { message: 'Nội dung tình hình từ 2 đến 2000 ký tự' })
  content: string;
}
