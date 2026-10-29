import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;
}
export class ResetPasswordDto {
  @IsString() @Length(64, 64) token: string;
  @IsString() @MinLength(10) @MaxLength(72) password: string;
}
export class PasswordDto {
  @IsString() @MaxLength(1000) password: string;
}
export class ChangePasswordDto extends PasswordDto {
  @IsString() @MaxLength(1000) currentPassword: string;
}
export class ProfileDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(100) title?: string | null;
}
