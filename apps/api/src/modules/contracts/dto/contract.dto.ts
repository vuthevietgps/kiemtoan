import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ContractStatus, InstallmentDueRule } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsMoney } from './money.decorator';

export class ContractServiceLineDto {
  @IsUUID('all', { message: 'Vui lòng chọn dịch vụ' })
  serviceTypeId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2025-10' })
  @IsOptional()
  @IsString()
  period?: string;

  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  quantity: number;

  @IsMoney('Đơn giá không hợp lệ')
  unitPrice: string;

  @IsOptional()
  @IsUUID('all')
  assigneeId?: string;
}

export class InstallmentDto {
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập tên đợt thanh toán' })
  name: string;

  @IsMoney('Số tiền đợt thanh toán không hợp lệ')
  amount: string;

  /** Hạn cố định; với đợt theo mốc BCKT là ngày dự kiến (J10). */
  @IsDateString({}, { message: 'Hạn thanh toán không hợp lệ' })
  dueDate: string;

  /** 07 J10: hạn theo ngày cố định (mặc định) hoặc N ngày sau phát hành BCKT. */
  @IsOptional()
  @IsEnum(InstallmentDueRule, {
    message: 'Quy tắc hạn thanh toán không hợp lệ',
  })
  dueRule?: InstallmentDueRule;

  @ValidateIf(
    (o: InstallmentDto) => o.dueRule === InstallmentDueRule.AFTER_REPORT_ISSUE,
  )
  @IsInt({ message: 'Số ngày sau phát hành BCKT từ 1 đến 365' })
  @Min(1, { message: 'Số ngày sau phát hành BCKT từ 1 đến 365' })
  @Max(365, { message: 'Số ngày sau phát hành BCKT từ 1 đến 365' })
  dueOffsetDays?: number;
}

export class CreateContractDto {
  @IsUUID('all', { message: 'Vui lòng chọn khách hàng' })
  customerId: string;

  @IsOptional()
  @IsUUID('all')
  ownerId?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày ký không hợp lệ' })
  signedDate?: string | null;

  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  endDate?: string | null;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber({}, { message: 'Thuế suất VAT không hợp lệ' })
  @Min(0)
  @Max(100)
  vatRate?: number;

  @IsOptional()
  @IsString()
  note?: string | null;

  /** Người phụ trách kinh doanh (E5) — tài khoản nội bộ. */
  @IsOptional()
  @IsUUID('all', { message: 'Người phụ trách kinh doanh không hợp lệ' })
  salesOwnerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referrerName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  referrerPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  referrerNote?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Hợp đồng phải có ít nhất một dòng dịch vụ' })
  @ValidateNested({ each: true })
  @Type(() => ContractServiceLineDto)
  services: ContractServiceLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallmentDto)
  installments?: InstallmentDto[];
}

/** Sửa hợp đồng: gửi services/installments thì thay toàn bộ danh sách cũ. */
export class UpdateContractDto extends PartialType(CreateContractDto) {}

export const CHANGEABLE_STATUSES = [
  ContractStatus.IN_PROGRESS,
  ContractStatus.COMPLETED,
  ContractStatus.LIQUIDATED,
  ContractStatus.CANCELLED,
] as const;
export type ChangeableStatus = (typeof CHANGEABLE_STATUSES)[number];

export class ChangeStatusDto {
  @IsIn(CHANGEABLE_STATUSES, { message: 'Trạng thái không hợp lệ' })
  status: ChangeableStatus;

  /** Lý do huỷ; bắt buộc khi HĐ đã có công việc (04-D). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5, { message: 'Lý do huỷ từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do huỷ từ 5 đến 500 ký tự' })
  reason?: string;
}

export class ReturnContractDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5, { message: 'Lý do trả lại từ 5 đến 500 ký tự' })
  @MaxLength(500, { message: 'Lý do trả lại từ 5 đến 500 ký tự' })
  reason: string;
}

export class ContractQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsIn(Object.values(ContractStatus))
  status?: ContractStatus;

  @IsOptional()
  @IsUUID('all')
  customerId?: string;
}
