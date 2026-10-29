import { crc16, transferText, vietQrPayload } from './vietqr';

describe('VietQR (07-D3, J9)', () => {
  it('CRC-16/CCITT-FALSE đúng giá trị kiểm chuẩn "123456789" = 29B1', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('chuỗi theo chuẩn: BIN + số TK, dịch vụ chuyển tới TK, VND, số tiền, VN, nội dung, CRC', () => {
    const payload = vietQrPayload({
      bin: '970407',
      accountNumber: '1903 6789 012',
      amount: 82500000,
      content: 'TT HD-2025-019',
    });
    expect(payload).toBe(
      '000201' +
        '010212' +
        '3855' +
        '0010A000000727' +
        '0125' +
        '0006970407' +
        '0111' + // số TK 11 chữ số (bỏ khoảng trắng)
        '19036789012' +
        '0208QRIBFTTA' +
        '5303704' +
        '540882500000' +
        '5802VN' +
        '6218' +
        '0814TT HD-2025-019' +
        '6304' +
        payload.slice(-4),
    );
    // CRC tính trên toàn chuỗi tới "6304".
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it('nội dung chuyển khoản bỏ dấu, viết hoa, bỏ ký tự lạ, tối đa 50 ký tự', () => {
    expect(transferText('Thanh toán đợt 2 — HĐ HD-2025-019!')).toBe(
      'THANH TOAN DOT 2 HD HD-2025-019',
    );
    expect(transferText('x'.repeat(80))).toHaveLength(50);
  });

  it('chặn BIN sai, số tài khoản sai, số tiền không nguyên dương', () => {
    const base = {
      bin: '970407',
      accountNumber: '123',
      amount: 1,
      content: 'TT',
    };
    expect(() => vietQrPayload({ ...base, bin: '9704' })).toThrow(/BIN/);
    expect(() => vietQrPayload({ ...base, accountNumber: '12-3' })).toThrow(
      /tài khoản/,
    );
    expect(() => vietQrPayload({ ...base, amount: 0 })).toThrow(/lớn hơn 0/);
    expect(() => vietQrPayload({ ...base, amount: 1.5 })).toThrow(/lớn hơn 0/);
  });
});
