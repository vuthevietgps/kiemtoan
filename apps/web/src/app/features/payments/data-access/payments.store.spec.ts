import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentDetail, PaymentInput, PaymentsApi } from './payments.api';
import { DEFAULT_QUERY, PaymentsStore } from './payments.store';

const detail = (revision: number, status = 'PENDING') =>
  ({ id: 'p1', revision, status }) as unknown as PaymentDetail;
const input: PaymentInput = {
  contractId: 'c1',
  amount: '1000000',
  paidDate: '2026-10-01',
  method: 'BANK_TRANSFER',
};
const conflict = (message: string) => throwError(() => ({ error: { message } }));

describe('PaymentsStore (07-C)', () => {
  const api = {
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    submit: vi.fn(),
    withdraw: vi.fn(),
    approve: vi.fn(),
    returnPayment: vi.fn(),
    cancel: vi.fn(),
  };
  let store: PaymentsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockImplementation((q: { status: string | null }) =>
      of({ items: [{ id: 'p1' }], total: q.status === 'PENDING' ? 4 : 9, page: 1, pageSize: 20 }),
    );
    api.detail.mockReturnValue(of(detail(2)));
    TestBed.configureTestingModule({
      providers: [PaymentsStore, { provide: PaymentsApi, useValue: api }],
    });
    store = TestBed.inject(PaymentsStore);
  });

  it('đổi bộ lọc về trang 1; tải bảng và đếm phiếu Chờ duyệt cho nhãn tab', async () => {
    store.setQuery({ page: 3 });
    store.setQuery({ status: 'RETURNED' });
    await vi.waitFor(() => expect(store.total()).toBe(9));
    expect(api.list).toHaveBeenCalledWith({ ...DEFAULT_QUERY, status: 'RETURNED', page: 1 });
    expect(api.list).toHaveBeenCalledWith({ ...DEFAULT_QUERY, pageSize: 1, status: 'PENDING' });
    expect(store.pendingCount()).toBe(4);
  });

  it('duyệt gửi đúng revision; thành công tải lại chi tiết và bảng', async () => {
    await store.open('p1');
    api.approve.mockReturnValue(of({ id: 'p1', status: 'APPROVED' }));
    api.detail.mockReturnValue(of(detail(3, 'APPROVED')));
    expect(await store.act({ kind: 'approve' })).toBe(true);
    expect(api.approve).toHaveBeenCalledWith('p1', 2);
    expect(store.detail()?.status).toBe('APPROVED');
    await vi.waitFor(() => expect(api.list).toHaveBeenCalled());
  });

  it('409 (người khác vừa duyệt): giữ thông báo, tải chi tiết mới nhất, hết bận', async () => {
    await store.open('p1');
    api.returnPayment.mockReturnValue(conflict('Phiếu thu vừa được người khác cập nhật'));
    api.detail.mockReturnValue(of(detail(3, 'APPROVED')));
    expect(await store.act({ kind: 'return', reason: 'Sai số tiền' })).toBe(false);
    expect(api.returnPayment).toHaveBeenCalledWith('p1', 2, 'Sai số tiền');
    expect(store.actionError()).toBe('Phiếu thu vừa được người khác cập nhật');
    expect(store.detail()?.revision).toBe(3);
    expect(store.busy()).toBe(false);
  });

  it('lập phiếu: tạo Nháp, đính kèm file rồi gửi duyệt với revision 1', async () => {
    const file = new File(['x'], 'sao-ke.pdf');
    api.create.mockReturnValue(of({ id: 'new' }));
    api.attach.mockReturnValue(of({ documentId: 'd1' }));
    api.submit.mockReturnValue(of({ id: 'new', status: 'PENDING' }));
    expect(await store.save(input, { file, submit: true })).toEqual({ id: 'new' });
    expect(api.create).toHaveBeenCalledWith(input);
    expect(api.attach).toHaveBeenCalledWith('new', file);
    expect(api.submit).toHaveBeenCalledWith('new', 1);
  });

  it('gửi duyệt bị từ chối (thiếu chứng từ): phiếu vẫn lưu nháp, trả lỗi để báo người dùng', async () => {
    api.create.mockReturnValue(of({ id: 'new' }));
    api.submit.mockReturnValue(conflict('Phiếu chuyển khoản cần đính kèm ít nhất một file'));
    const result = await store.save(input, { submit: true });
    expect(result).toEqual({ id: 'new', submitError: 'Phiếu chuyển khoản cần đính kèm ít nhất một file' });
    expect(api.attach).not.toHaveBeenCalled();
  });

  it('sửa phiếu Trả lại: PATCH với revision hiện tại, gửi lại với revision + 1; không gửi contractId', async () => {
    api.update.mockReturnValue(of({ id: 'p1' }));
    api.submit.mockReturnValue(of({ id: 'p1', status: 'PENDING' }));
    await store.save(input, { submit: true, existing: detail(3, 'RETURNED') });
    const { amount, paidDate, method } = input;
    expect(api.update).toHaveBeenCalledWith('p1', 3, { amount, paidDate, method });
    expect(api.submit).toHaveBeenCalledWith('p1', 4);
    expect(api.create).not.toHaveBeenCalled();
  });
});
