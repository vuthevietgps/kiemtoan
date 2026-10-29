import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentTemplateType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
const TYPE_MESSAGE = 'Loại hồ sơ không hợp lệ';

export class TemplateQueryDto {
  @ApiPropertyOptional({ enum: DocumentTemplateType })
  @IsOptional()
  @IsEnum(DocumentTemplateType, { message: TYPE_MESSAGE })
  type?: DocumentTemplateType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}

/** Trường đi kèm file mẫu trong form multipart. */
export class CreateTemplateDto {
  @IsEnum(DocumentTemplateType, { message: TYPE_MESSAGE })
  type: DocumentTemplateType;

  @IsString()
  @Length(2, 200, { message: 'Tên mẫu từ 2 đến 200 ký tự' })
  name: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class TemplateVersionDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @Length(2, 200, { message: 'Tên mẫu từ 2 đến 200 ký tự' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GenerateDocumentDto {
  @IsUUID('all', { message: 'Mẫu hồ sơ không hợp lệ' })
  templateId: string;

  /** Có thì thêm phiên bản mới cho hồ sơ đã sinh trước đó, không tạo hồ sơ mới. */
  @IsOptional()
  @IsUUID('all', { message: 'Hồ sơ không hợp lệ' })
  documentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/** Bản scan đã ký (multipart). */
export class UploadSignedDto {
  @IsEnum(DocumentTemplateType, { message: TYPE_MESSAGE })
  type: DocumentTemplateType;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID('all', { message: 'Hồ sơ không hợp lệ' })
  documentId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(2000)
  note?: string;
}
