import { Prisma } from '@prisma/client';

const DIGITS = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
];
const GROUP_UNITS = ['', 'nghìn', 'triệu'];
const BILLION = 1_000_000_000n;

/** Đọc số 0–999. `full`: nhóm đứng sau nhóm khác nên đọc đủ "không trăm", "linh". */
function readHundreds(value: number, full: boolean): string[] {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const words: string[] = [];
  if (hundreds > 0 || full) words.push(DIGITS[hundreds], 'trăm');
  if (tens === 0) {
    if (units > 0 && words.length > 0) words.push('linh');
  } else if (tens === 1) {
    words.push('mười');
  } else {
    words.push(DIGITS[tens], 'mươi');
  }
  if (units === 0) return words;
  if (units === 1 && tens >= 2) words.push('mốt');
  else if (units === 5 && tens >= 1) words.push('lăm');
  else words.push(DIGITS[units]);
  return words;
}

/** Đọc số nhỏ hơn một tỷ theo nhóm nghìn/triệu; `full` khi đứng sau phần "tỷ". */
function readBelowBillion(value: number, full: boolean): string[] {
  const groups = [
    Math.floor(value / 1_000_000),
    Math.floor(value / 1000) % 1000,
    value % 1000,
  ];
  const words: string[] = [];
  groups.forEach((group, index) => {
    if (group === 0) return;
    const unit = GROUP_UNITS[2 - index];
    words.push(...readHundreds(group, full || words.length > 0));
    if (unit) words.push(unit);
  });
  return words;
}

function readInteger(value: bigint): string[] {
  if (value < BILLION) return readBelowBillion(Number(value), false);
  const billions = value / BILLION;
  const rest = Number(value % BILLION);
  return [...readInteger(billions), 'tỷ', ...readBelowBillion(rest, true)];
}

/**
 * Số tiền VND bằng chữ cho hồ sơ thương mại (C8), ví dụ 11.000.000 → "Mười một triệu đồng".
 * Làm tròn đến đồng; số âm đọc kèm "Âm".
 */
export function vndInWords(amount: Prisma.Decimal | string | number): string {
  const rounded = new Prisma.Decimal(amount).toDecimalPlaces(
    0,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  const negative = rounded.isNegative() && !rounded.isZero();
  const value = BigInt(rounded.abs().toFixed(0));
  const words = value === 0n ? ['không'] : readInteger(value);
  const text = [...(negative ? ['âm'] : []), ...words, 'đồng'].join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Định dạng tiền kiểu Việt Nam không kèm đơn vị: 1250000 → "1.250.000". */
export function formatVnd(amount: Prisma.Decimal | string | number): string {
  const rounded = new Prisma.Decimal(amount).toDecimalPlaces(
    0,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  const digits = rounded.abs().toFixed(0);
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded.isNegative() && !rounded.isZero() ? `-${grouped}` : grouped;
}
