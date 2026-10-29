/**
 * Chuỗi mã VietQR (chuẩn EMVCo QR thanh toán, đặc tả NAPAS "chuyển tiền đến tài khoản") — 07 J9.
 * Hàm thuần: app ngân hàng quét ra người nhận (BIN + số tài khoản), số tiền và nội dung chuyển khoản.
 */

const NAPAS_GUID = 'A000000727';
const SERVICE_TO_ACCOUNT = 'QRIBFTTA';
const VND = '704';

/** Một trường TLV: mã 2 số + độ dài 2 số + giá trị. */
function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC-16/CCITT-FALSE (đa thức 0x1021, khởi tạo 0xFFFF) theo EMVCo, in 4 chữ số hex hoa. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nội dung chuyển khoản: bỏ dấu tiếng Việt, chỉ giữ chữ/số/khoảng trắng/gạch, tối đa 50 ký tự. */
export function transferText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 \-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 50);
}

export interface VietQrInput {
  /** Mã BIN 6 số của ngân hàng nhận (vd. Techcombank 970407). */
  bin: string;
  accountNumber: string;
  /** Số tiền VND (số nguyên dương). */
  amount: number;
  content: string;
}

/** Ghép chuỗi VietQR động (có số tiền). Đầu vào sai → lỗi (người gọi báo 400). */
export function vietQrPayload(input: VietQrInput): string {
  const bin = input.bin.trim();
  const account = input.accountNumber.replace(/\s/g, '');
  if (!/^\d{6}$/.test(bin))
    throw new Error('Mã BIN ngân hàng phải gồm 6 chữ số');
  if (!/^[A-Za-z0-9]{1,19}$/.test(account))
    throw new Error('Số tài khoản nhận tiền không hợp lệ');
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    throw new Error('Số tiền đề nghị thanh toán phải lớn hơn 0');
  const merchant =
    tlv('00', NAPAS_GUID) +
    tlv('01', tlv('00', bin) + tlv('01', account)) +
    tlv('02', SERVICE_TO_ACCOUNT);
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchant) +
    tlv('53', VND) +
    tlv('54', String(input.amount)) +
    tlv('58', 'VN') +
    tlv('62', tlv('08', transferText(input.content))) +
    '6304';
  return body + crc16(body);
}
