import { AmendmentLineAction } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsMoney } from './money.decorator';

export class AmendmentLineDto {
  @IsEnum(AmendmentLineAction, { message: 'Thay đổi không hợp lệ' })
  action: AmendmentLineAction;

  /** Dòng dịch vụ của HĐ cần sửa/bỏ (UPDATE, REMOVE). */
  @IsOptional()
  @IsUUID('all')
  contractServiceId?: string;

  /** Dịch vụ của dòng thêm mới (ADD). */
  @IsOptional()
  @IsUUID('all', { message: 'Vui lòng chọn dịch vụ' })
  serviceTypeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  period?: string;

  @IsOptional()
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  quantity?: number;

  @IsOptional()
  @IsMoney('Đơn giá không hợp lệ')
  unitPrice?: string;

  @IsOptional()
  @IsUUID('all')
  assigneeId?: string;
}

export class AmendmentInstallmentDto {
  /** Đợt hiện có của HĐ; bỏ trống là đợt mới. */
  @IsOptional()
  @IsUUID('all')
  id?: string;

  @IsString()
  @Length(1, 200, { message: 'Vui lòng nhập tên đợt thanh toán' })
  name: string;

  @IsMoney('Số tiền đợt thanh toán không hợp lệ')
  amount: string;

  @IsDateString({}, { message: 'Hạn thanh toán không hợp lệ' })
  dueDate: string;
}

/** Lưu phụ lục nháp: gửi toàn bộ thay đổi; không gửi lịch thì hệ thống đề xuất. */
export class SaveAmendmentDto {
  @IsString()
  @Length(2, 200, { message: 'Tiêu đề phụ lục từ 2 đến 200 ký tự' })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày hiệu lực không hợp lệ' })
  effectiveDate?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Phụ lục cần ít nhất một thay đổi' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AmendmentLineDto)
  lines: AmendmentLineDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => AmendmentInstallmentDto)
  installments?: AmendmentInstallmentDto[];
}
