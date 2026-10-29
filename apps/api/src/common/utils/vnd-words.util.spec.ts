import { Prisma } from '@prisma/client';
import { formatVnd, vndInWords } from './vnd-words.util';

describe('vndInWords', () => {
  it.each([
    [0, 'Không đồng'],
    [5, 'Năm đồng'],
    [10, 'Mười đồng'],
    [15, 'Mười lăm đồng'],
    [21, 'Hai mươi mốt đồng'],
    [25, 'Hai mươi lăm đồng'],
    [105, 'Một trăm linh năm đồng'],
    [110, 'Một trăm mười đồng'],
    [1_000, 'Một nghìn đồng'],
    [11_000_000, 'Mười một triệu đồng'],
    [1_250_500, 'Một triệu hai trăm năm mươi nghìn năm trăm đồng'],
    [2_005_000, 'Hai triệu không trăm linh năm nghìn đồng'],
    [1_000_100, 'Một triệu một trăm đồng'],
    [1_000_000_000, 'Một tỷ đồng'],
    [
      2_015_000_021,
      'Hai tỷ không trăm mười lăm triệu không trăm hai mươi mốt đồng',
    ],
  ])('%d → %s', (amount, words) => {
    expect(vndInWords(amount)).toBe(words);
  });

  it('reads thousands of billions and Decimal values from the database', () => {
    expect(vndInWords(new Prisma.Decimal('1000000000000.00'))).toBe(
      'Một nghìn tỷ đồng',
    );
    expect(vndInWords('13200000.00')).toBe('Mười ba triệu hai trăm nghìn đồng');
  });

  it('rounds to whole đồng and reads negative amounts', () => {
    expect(vndInWords('999.5')).toBe('Một nghìn đồng');
    expect(vndInWords(-1_500_000)).toBe('Âm một triệu năm trăm nghìn đồng');
  });
});

describe('formatVnd', () => {
  it('groups thousands with dots', () => {
    expect(formatVnd(new Prisma.Decimal('13200000.00'))).toBe('13.200.000');
    expect(formatVnd(0)).toBe('0');
    expect(formatVnd(-1250000)).toBe('-1.250.000');
  });
});
