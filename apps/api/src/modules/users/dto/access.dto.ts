import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AccessProposalDto {
  @IsEnum(Role) role: Role;
  @IsOptional() @IsUUID() accessRoleId?: string | null;
  @IsOptional() @IsBoolean() financialAccess?: boolean | null;
  @IsOptional() @IsBoolean() secretAccess?: boolean | null;
}
export class AccessRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;
  @IsIn([Role.MANAGER, Role.STAFF, Role.CASHIER]) baseRole: Role;
  @IsIn(['ALL', 'TEAM', 'OWN', 'NONE']) scope: string;
  @IsArray() @IsString({ each: true }) permissions: string[];
}
export class AccessReviewDto {
  @IsBoolean() approve: boolean;
  @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
export class AccessRequestQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) status?: string;
}
export class TeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;
}
