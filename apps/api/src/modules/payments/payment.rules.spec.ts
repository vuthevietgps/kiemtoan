import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  BILLABLE_CONTRACT,
  isSelfReview,
  OPEN_STATUSES,
  submitError,
  TRANSITIONS,
} from './payment.rules';

describe('payment.rules (07-C)', () => {
  it('chuyển trạng thái: chỉ duyệt/trả lại phiếu Chờ duyệt; chỉ huỷ phiếu Đã duyệt; rút khi chưa duyệt', () => {
    expect(TRANSITIONS.submit.from).toEqual([
      PaymentStatus.DRAFT,
      PaymentStatus.RETURNED,
    ]);
    expect(TRANSITIONS.approve.from).toEqual([PaymentStatus.PENDING]);
    expect(TRANSITIONS.return.from).toEqual([PaymentStatus.PENDING]);
    expect(TRANSITIONS.cancel.from).toEqual([PaymentStatus.APPROVED]);
    expect(TRANSITIONS.withdraw.from).not.toContain(PaymentStatus.APPROVED);
    expect(TRANSITIONS.withdraw.to).toBe(PaymentStatus.CANCELLED);
  });

  it('J6: phiếu đang mở (cả nháp, chờ duyệt, trả lại) tính vào giới hạn không thu vượt; phiếu huỷ thì không', () => {
    expect(OPEN_STATUSES).toContain(PaymentStatus.DRAFT);
    expect(OPEN_STATUSES).toContain(PaymentStatus.PENDING);
    expect(OPEN_STATUSES).not.toContain(PaymentStatus.CANCELLED);
  });

  it('J7: không thu HĐ nháp, chờ duyệt, huỷ', () => {
    expect(BILLABLE_CONTRACT).not.toContain('DRAFT');
    expect(BILLABLE_CONTRACT).not.toContain('PENDING_APPROVAL');
    expect(BILLABLE_CONTRACT).not.toContain('CANCELLED');
    expect(BILLABLE_CONTRACT).toContain('LIQUIDATED');
  });

  it('J8: chuyển khoản cần file, tiền mặt cần số phiếu giấy', () => {
    expect(
      submitError({
        method: PaymentMethod.BANK_TRANSFER,
        documentNumber: 'FT123',
        documentCount: 0,
      }),
    ).toMatch(/ít nhất một file/);
    expect(
      submitError({
        method: PaymentMethod.BANK_TRANSFER,
        documentNumber: null,
        documentCount: 1,
      }),
    ).toBeNull();
    expect(
      submitError({
        method: PaymentMethod.CASH,
        documentNumber: '  ',
        documentCount: 2,
      }),
    ).toMatch(/số phiếu thu giấy/);
    expect(
      submitError({
        method: PaymentMethod.CASH,
        documentNumber: 'PT-GIAY-01',
        documentCount: 0,
      }),
    ).toBeNull();
  });

  it('J1: người lập không tự duyệt', () => {
    expect(isSelfReview({ receivedById: 'u1' }, 'u1')).toBe(true);
    expect(isSelfReview({ receivedById: 'u1' }, 'u2')).toBe(false);
  });
});
