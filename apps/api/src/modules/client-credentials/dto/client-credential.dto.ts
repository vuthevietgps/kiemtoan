import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  CredentialStatus,
  CredentialType,
  TokenCustody,
  TokenProvider,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Chuỗi rỗng = xoá giá trị (null); không gửi = giữ nguyên. */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && !value.trim() ? null : trim({ value });
const flag = ({ value }: { value: unknown }) =>
  value === true || value === 'true';

/** Nơi giữ khi tạo / đổi tay (L3). "Đang mượn" chỉ qua mượn / giao; "Chưa xác định" chỉ do chuyển đổi. */
export const SETTABLE_CUSTODY = [
  TokenCustody.OFFICE,
  TokenCustody.CUSTOMER,
] as const;
export type SettableCustody = (typeof SETTABLE_CUSTODY)[number];

export class RevisionDto {
  @Type(() => Number)
  @IsInt({ message: 'Thiếu phiên bản dữ liệu (revision)' })
  @Min(1)
  revision: number;
}

export class CreateClientCredentialDto {
  @IsUUID('all', { message: 'Khách hàng không hợp lệ' })
  customerId: string;

  @IsEnum(CredentialType, { message: 'Loại tài khoản không hợp lệ' })
  type: CredentialType;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200, { message: 'Tên tài khoản tối đa 200 ký tự' })
  label?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500, { message: 'Địa chỉ cổng tối đa 500 ký tự' })
  url?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200, { message: 'Tên đăng nhập tối đa 200 ký tự' })
  username?: string | null;

  /** Mật khẩu / mã PIN. Sửa: chỉ đổi khi gửi giá trị khác rỗng. */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Mật khẩu tối đa 500 ký tự' })
  password?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString({}, { message: 'Ngày hết hạn không hợp lệ' })
  expiresAt?: string | null;

  @IsOptional()
  @IsEnum(CredentialStatus, { message: 'Trạng thái không hợp lệ' })
  status?: CredentialStatus;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @IsOptional()
  @IsEnum(TokenProvider, { message: 'Nhà cung cấp chữ ký số không hợp lệ' })
  provider?: TokenProvider | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100, { message: 'Số serial tối đa 100 ký tự' })
  serialNumber?: string | null;

  @IsOptional()
  @IsIn(SETTABLE_CUSTODY, { message: 'Nơi giữ token không hợp lệ' })
  custody?: SettableCustody;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200, { message: 'Vị trí cất tối đa 200 ký tự' })
  storageLocation?: string | null;
}

/** Sửa: không đổi khách hàng; nơi giữ đổi qua các lệnh token (L3–L4). */
export class UpdateClientCredentialDto extends PartialType(
  OmitType(CreateClientCredentialDto, ['customerId', 'custody'] as const),
) {
  @Type(() => Number)
  @IsInt({ message: 'Thiếu phiên bản dữ liệu (revision)' })
  @Min(1)
  revision: number;
}

/** Xoá mềm cần lý do (L10). */
export class DeleteCredentialDto extends RevisionDto {
  @Transform(trim)
  @IsString()
  @Length(1, 500, { message: 'Vui lòng nhập lý do xoá (tối đa 500 ký tự)' })
  reason: string;
}

export const SECRET_PURPOSES = ['VIEW', 'COPY'] as const;
export type SecretPurpose = (typeof SECRET_PURPOSES)[number];

export class SecretRequestDto {
  @IsOptional()
  @IsIn(SECRET_PURPOSES, { message: 'Mục đích phải là VIEW hoặc COPY' })
  purpose?: SecretPurpose;
}

/** Báo lỗi đăng nhập (L7). */
export class ReportIssueDto extends RevisionDto {
  @IsIn([CredentialStatus.ERROR, CredentialStatus.NEED_CHANGE], {
    message: 'Chỉ báo "Lỗi đăng nhập" hoặc "Cần đổi mật khẩu"',
  })
  status: 'ERROR' | 'NEED_CHANGE';

  @Transform(trim)
  @IsString()
  @Length(1, 1000, { message: 'Vui lòng ghi rõ lỗi gặp phải' })
  note: string;
}

export class BorrowTokenDto extends RevisionDto {
  @IsDateString({}, { message: 'Hạn trả không hợp lệ' })
  dueDate: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  purpose?: string | null;
}

export class HandOverTokenDto extends BorrowTokenDto {
  @IsUUID('all', { message: 'Người nhận không hợp lệ' })
  holderId: string;
}

export class ReturnTokenDto extends RevisionDto {
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  storageLocation?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

/** Nhận từ khách / trả khách / thu hồi / đổi nơi cất (L4, quyền `update`). */
export class TokenCustodyDto extends ReturnTokenDto {
  @IsIn(SETTABLE_CUSTODY, { message: 'Nơi giữ token không hợp lệ' })
  custody: SettableCustody;
}

export const CREDENTIAL_KINDS = ['ACCOUNT', 'TOKEN'] as const;

export class ClientCredentialQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: CredentialType })
  @IsOptional()
  @IsEnum(CredentialType)
  type?: CredentialType;

  /** Tab: tài khoản cổng / chữ ký số. */
  @ApiPropertyOptional({ enum: CREDENTIAL_KINDS })
  @IsOptional()
  @IsIn(CREDENTIAL_KINDS)
  kind?: (typeof CREDENTIAL_KINDS)[number];

  @ApiPropertyOptional({ enum: CredentialStatus })
  @IsOptional()
  @IsEnum(CredentialStatus)
  status?: CredentialStatus;

  @ApiPropertyOptional({ enum: TokenCustody })
  @IsOptional()
  @IsEnum(TokenCustody)
  custody?: TokenCustody;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  holderId?: string;

  /** Hết hạn trong 30 ngày tới (gồm đã hết hạn). */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(flag)
  expiring?: boolean;

  /** Token đang mượn đã quá hạn trả. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(flag)
  overdueLoan?: boolean;
}
