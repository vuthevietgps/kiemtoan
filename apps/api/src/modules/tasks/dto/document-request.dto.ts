import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentRequestStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DocumentRequestQueryDto {
  @IsOptional()
  @IsUUID('all')
  customerId?: string;

  @IsOptional()
  @IsUUID('all')
  contractId?: string;

  @IsOptional()
  @IsUUID('all')
  contractServiceId?: string;

  /** Hồ sơ của bước và kỳ của việc này (chi tiết việc). */
  @IsOptional()
  @IsUUID('all')
  taskId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  period?: string;

  @ApiPropertyOptional({ enum: DocumentRequestStatus })
  @IsOptional()
  @IsEnum(DocumentRequestStatus, { message: 'Trạng thái hồ sơ không hợp lệ' })
  status?: DocumentRequestStatus;
}

/** Ghi nhận đã yêu cầu khách (chưa có cổng khách hàng — QD00). */
export class MarkRequestedDto {
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Ngày yêu cầu không hợp lệ' })
  requestedAt?: string;

  /** Cách gửi: email, Zalo, điện thoại, gặp trực tiếp… */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Cách gửi tối đa 100 ký tự' })
  method?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Hạn khách gửi không hợp lệ' })
  clientDueDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RequestNoteDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/** "Cần bổ sung" bắt buộc ghi nội dung (PL1 V). */
export class SupplementDto {
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Nội dung cần bổ sung từ 5 đến 2000 ký tự' })
  @MaxLength(2000, { message: 'Nội dung cần bổ sung từ 5 đến 2000 ký tự' })
  note: string;
}
