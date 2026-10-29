import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateContactDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  title?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? null : trim({ value }),
  )
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateContactDto extends PartialType(CreateContactDto, {
  skipNullProperties: false,
}) {}

export class AssignCustomerDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
