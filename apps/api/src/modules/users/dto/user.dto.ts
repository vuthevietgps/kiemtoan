import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Mật khẩu tối thiểu 10 ký tự' })
  @MaxLength(72)
  password?: string;

  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập họ tên' })
  @MaxLength(150)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fullName: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @IsOptional() @IsUUID() accessRoleId?: string | null;
  @IsOptional() @IsBoolean() financialAccess?: boolean | null;
  @IsOptional() @IsBoolean() secretAccess?: boolean | null;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password'] as const),
) {
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Mật khẩu tối thiểu 10 ký tự' })
  @MaxLength(72)
  password?: string;
}

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsIn(['ACTIVE', 'LOCKED', 'INVITED', 'LEFT']) status?: string;
}
