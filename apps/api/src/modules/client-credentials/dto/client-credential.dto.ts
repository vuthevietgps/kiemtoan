import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { CredentialStatus, CredentialType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class CreateClientCredentialDto {
  @IsUUID('all', { message: 'Khách hàng không hợp lệ' })
  customerId: string;

  @IsEnum(CredentialType, { message: 'Loại tài khoản không hợp lệ' })
  type: CredentialType;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập tên đăng nhập' })
  username: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu' })
  password: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString({}, { message: 'Ngày hết hạn không hợp lệ' })
  expiresAt?: string | null;

  @IsOptional()
  @IsEnum(CredentialStatus, { message: 'Trạng thái không hợp lệ' })
  status?: CredentialStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

/** Sửa: không đổi khách hàng; chỉ đổi mật khẩu khi có gửi password. */
export class UpdateClientCredentialDto extends PartialType(
  OmitType(CreateClientCredentialDto, ['customerId'] as const),
) {}

export class ClientCredentialQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: CredentialType })
  @IsOptional()
  @IsEnum(CredentialType)
  type?: CredentialType;
}
