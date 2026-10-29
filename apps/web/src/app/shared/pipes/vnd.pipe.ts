import { Pipe, PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** 1500000 hoặc "1500000.00" → "1.500.000 đ". API trả tiền dạng chuỗi (Decimal). */
@Pipe({ name: 'vnd' })
export class VndPipe implements PipeTransform {
  transform(value: number | string | null | undefined, unit = true): string {
    if (value === null || value === undefined || value === '') return '';
    const text = formatter.format(Number(value));
    return unit ? `${text} đ` : text;
  }
}
