import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/**
 * Số tiền nhận dạng chuỗi hoặc số (ví dụ "1500000" hoặc 1500000), chuyển thành chuỗi
 * để service tính bằng Prisma.Decimal — không bao giờ tính tiền bằng number.
 */
export function IsMoney(message = 'Số tiền không hợp lệ') {
  return applyDecorators(
    ApiProperty({ type: String, example: '1500000' }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'number' ? String(value) : value,
    ),
    Matches(/^\d{1,16}(\.\d{1,2})?$/, { message }),
  );
}
