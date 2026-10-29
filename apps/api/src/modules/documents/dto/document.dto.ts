import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

/** Trường đi kèm file trong form multipart. */
export class UploadDocumentDto {
  @IsEnum(DocumentCategory, { message: 'Thư mục tài liệu không hợp lệ' })
  category: DocumentCategory;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID('all', { message: 'Hợp đồng không hợp lệ' })
  contractId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/, {
    message: 'Kỳ phải có dạng YYYY-MM hoặc YYYY-Q1..Q4',
  })
  period?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class DocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/)
  period?: string;
}

export class UploadVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
