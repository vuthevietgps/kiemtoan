import { Prisma } from '@prisma/client';
import { toCsv } from './csv.util';

const dec = (v: number) => new Prisma.Decimal(v);

describe('toCsv', () => {
  it('có BOM, escape dấu phẩy và ngoặc kép', () => {
    const csv = toCsv(['Tên', 'Tiền'], [['Công ty "A", HN', dec(1000)]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Công ty ""A"", HN",1000');
  });
});
