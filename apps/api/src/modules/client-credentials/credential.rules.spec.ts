import {
  changedFields,
  custodyEvent,
  daysUntil,
  loanDueError,
  normalizeSerial,
  shapeError,
} from './credential.rules';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const account = {
  type: 'TAX_PORTAL' as const,
  label: null,
  username: 'mst',
  hasSecret: true,
  expiresAt: null,
  provider: null,
  serialNumber: null,
};

describe('credential.rules (đặc tả 09)', () => {
  it('L1/L2: bắt buộc theo loại', () => {
    expect(shapeError(account)).toBeNull();
    expect(shapeError({ ...account, username: null })).toMatch(/tên đăng nhập/);
    expect(shapeError({ ...account, hasSecret: false })).toMatch(/mật khẩu/);
    expect(shapeError({ ...account, type: 'OTHER' })).toMatch(/Khác/);
    const token = {
      ...account,
      type: 'DIGITAL_SIGNATURE' as const,
      username: null,
      hasSecret: false,
      provider: 'VNPT_CA' as const,
      serialNumber: 'ABC',
      expiresAt: d('2027-01-01'),
    };
    expect(shapeError(token)).toBeNull(); // token không cần tên đăng nhập / PIN
    expect(shapeError({ ...token, provider: null })).toMatch(/nhà cung cấp/);
    expect(shapeError({ ...token, serialNumber: null })).toMatch(/serial/);
    expect(shapeError({ ...token, expiresAt: null })).toMatch(/hạn/);
  });

  it('chuẩn hoá serial: bỏ khoảng trắng hai đầu, viết hoa, rỗng → null', () => {
    expect(normalizeSerial('  ab-01 ')).toBe('AB-01');
    expect(normalizeSerial('  ')).toBeNull();
    expect(normalizeSerial(undefined)).toBeNull();
  });

  it('L4: hạn trả từ hôm nay đến tối đa 30 ngày', () => {
    const today = d('2026-10-30');
    expect(loanDueError(d('2026-10-30'), today)).toBeNull();
    expect(loanDueError(d('2026-11-29'), today)).toBeNull();
    expect(loanDueError(d('2026-10-29'), today)).toMatch(/trước hôm nay/);
    expect(loanDueError(d('2026-11-30'), today)).toMatch(/30 ngày/);
  });

  it('L4: sự kiện khi đặt nơi giữ', () => {
    const event = (
      from: Parameters<typeof custodyEvent>[0],
      to: 'OFFICE' | 'CUSTOMER',
    ) => custodyEvent(from, to);
    expect(event('OFFICE', 'CUSTOMER')).toEqual({
      event: 'RETURNED_TO_CUSTOMER',
    });
    expect(event('CUSTOMER', 'OFFICE')).toEqual({
      event: 'RECEIVED_FROM_CUSTOMER',
    });
    expect(event('LOANED', 'OFFICE')).toEqual({ event: 'RETURNED' });
    expect(event('UNKNOWN', 'OFFICE')).toEqual({ event: 'LOCATION_CHANGED' });
    expect(event('OFFICE', 'OFFICE')).toEqual({ event: 'LOCATION_CHANGED' });
    expect(event('CUSTOMER', 'CUSTOMER')).toEqual({
      error: 'Token đang do khách hàng giữ',
    });
  });

  it('chỉ liệt kê tên trường đổi, so ngày theo giá trị', () => {
    expect(
      changedFields(
        { label: 'A', url: null, expiresAt: d('2027-01-01') },
        { label: 'B', url: undefined, expiresAt: d('2027-01-01') },
      ),
    ).toEqual(['label']);
  });

  it('số ngày đến hạn (âm khi đã quá)', () => {
    const today = d('2026-10-30');
    expect(daysUntil(d('2026-11-06'), today)).toBe(7);
    expect(daysUntil(d('2026-10-28'), today)).toBe(-2);
    expect(daysUntil(null, today)).toBeNull();
  });
});
