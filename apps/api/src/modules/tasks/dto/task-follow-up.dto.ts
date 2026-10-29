import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Người làm chuyển tay sang Chờ khách: chọn hồ sơ yêu cầu có sẵn hoặc tạo hồ sơ mới gửi khách (H4). */
export class WaitClientDto {
  @IsOptional()
  @IsUUID('all', { message: 'Hồ sơ yêu cầu không hợp lệ' })
  requestId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Tên hồ sơ cần khách gửi từ 2 đến 200 ký tự' })
  @MaxLength(200, { message: 'Tên hồ sơ cần khách gửi từ 2 đến 200 ký tự' })
  requestName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  method?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/** Lý do bắt buộc (tạm dừng, mở lại). */
export class ReasonDto {
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Lý do từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do từ 5 đến 500 ký tự' })
  reason: string;
}

export class OptionalNoteDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Đề nghị gia hạn (H7); `documented` = Giám đốc ghi nhận văn bản lùi hạn pháp lý. */
export class DueChangeRequestDto {
  @IsDateString({ strict: true }, { message: 'Hạn mới không hợp lệ' })
  newDue: string;

  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Lý do gia hạn từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do gia hạn từ 5 đến 500 ký tự' })
  reason: string;

  @IsOptional()
  @IsBoolean()
  documented?: boolean;
}

export class DueDecisionDto {
  @IsBoolean({ message: 'Vui lòng chọn duyệt hoặc từ chối' })
  approve: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}
