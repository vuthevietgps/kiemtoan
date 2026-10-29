import {
  computeTotals,
  exceedsRemaining,
  formatCode,
  nextSequence,
  paymentStatusOf,
} from './contract-calculator';
import { canTransition } from './contracts.constants';

describe('contract-calculator', () => {
  it('tính thành tiền, trước VAT, VAT và tổng bằng Decimal', () => {
    const r = computeTotals(
      [
        { quantity: 12, unitPrice: '1500000' },
        { quantity: 1, unitPrice: '0.1' },
        { quantity: 2, unitPrice: '0.2' },
      ],
      10,
    );
    expect(r.lineAmounts.map((a) => a.toString())).toEqual([
      '18000000',
      '0.1',
      '0.4',
    ]);
    expect(r.subtotal.toString()).toBe('18000000.5');
    expect(r.vatAmount.toString()).toBe('1800000');
    expect(r.total.toString()).toBe('19800000.5');
  });

  it('VAT làm tròn đến đồng', () => {
    const r = computeTotals([{ quantity: 1, unitPrice: '1005' }], 8);
    expect(r.vatAmount.toString()).toBe('80');
  });

  it('sinh mã HD-YYYY-NNN tăng dần', () => {
    expect(formatCode('HD', 2025, 7)).toBe('HD-2025-007');
    expect(nextSequence([])).toBe(1);
    expect(nextSequence(['HD-2025-011', 'HD-2025-015', 'HD-2025-002'])).toBe(
      16,
    );
    expect(formatCode('PT', 2026, nextSequence(['PT-2026-999']))).toBe(
      'PT-2026-1000',
    );
  });

  it('trạng thái thanh toán', () => {
    expect(paymentStatusOf('100', '0')).toBe('UNPAID');
    expect(paymentStatusOf('100', '40')).toBe('PARTIAL');
    expect(paymentStatusOf('100', '100')).toBe('PAID');
  });

  it('07-D2: còn nợ và có đợt quá hạn → Còn nợ quá hạn; thu đủ thì Đã thanh toán dù có số quá hạn', () => {
    expect(paymentStatusOf('100', '0', '30')).toBe('OVERDUE');
    expect(paymentStatusOf('100', '40', '30')).toBe('OVERDUE');
    expect(paymentStatusOf('100', '40', '0')).toBe('PARTIAL');
    expect(paymentStatusOf('100', '100', '0')).toBe('PAID');
  });

  it('chặn thu vượt số còn phải thu', () => {
    expect(exceedsRemaining('100', '60', '40')).toBe(false);
    expect(exceedsRemaining('100', '60', '40.01')).toBe(true);
  });

  it('chỉ cho chuyển trạng thái hợp lệ', () => {
    expect(canTransition('NOT_STARTED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransition('DRAFT', 'COMPLETED')).toBe(false);
    expect(canTransition('CANCELLED', 'IN_PROGRESS')).toBe(false);
  });
});
