import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentRequestPreview, PaymentsApi } from './payments.api';
import { PaymentRequestStore } from './payment-request.store';

const preview = (amount: string) => ({ amount }) as unknown as PaymentRequestPreview;

describe('PaymentRequestStore (07-D3)', () => {
  const api = {
    previewPaymentRequest: vi.fn(),
    createPaymentRequest: vi.fn(),
    document: vi.fn(),
  };
  let store: PaymentRequestStore;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [PaymentRequestStore, { provide: PaymentsApi, useValue: api }],
    });
    store = TestBed.inject(PaymentRequestStore);
  });

  it('xem trước theo đợt chọn; bỏ chọn hết thì không gọi API và xoá xem trước', async () => {
    api.previewPaymentRequest.mockReturnValue(of(preview('2000000')));
    await store.load('c1', ['i2', 'i3']);
    expect(api.previewPaymentRequest).toHaveBeenCalledWith({
      contractId: 'c1',
      installmentIds: ['i2', 'i3'],
    });
    expect(store.preview()?.amount).toBe('2000000');
    await store.load('c1', []);
    expect(store.preview()).toBeNull();
    expect(api.previewPaymentRequest).toHaveBeenCalledTimes(1);
  });

  it('đổi chọn nhanh: kết quả xem trước cũ về sau bị bỏ qua', async () => {
    const slow = new Subject<PaymentRequestPreview>();
    api.previewPaymentRequest.mockReturnValueOnce(slow).mockReturnValueOnce(of(preview('1000000')));
    const first = store.load('c1', ['i2', 'i3']);
    await store.load('c1', ['i2']);
    slow.next(preview('2000000'));
    slow.complete();
    await first;
    expect(store.preview()?.amount).toBe('1000000');
  });

  it('tạo file: gọi tạo rồi tải file đã lưu; lỗi giữ thông báo, hết bận', async () => {
    const file = new Blob(['docx']);
    api.createPaymentRequest.mockReturnValue(of({ id: 'cd1', type: 'PAYMENT_REQUEST', document: { id: 'd1', fileName: 'a.docx' } }));
    api.document.mockReturnValue(of(file));
    const result = await store.create('c1', ['i2']);
    expect(api.document).toHaveBeenCalledWith('d1');
    expect(result?.file).toBe(file);
    api.createPaymentRequest.mockReturnValue(
      throwError(() => ({ error: { message: 'Chỉ lập đề nghị thanh toán cho hợp đồng đã duyệt' } })),
    );
    expect(await store.create('c1', ['i2'])).toBeNull();
    expect(store.error()).toBe('Chỉ lập đề nghị thanh toán cho hợp đồng đã duyệt');
    expect(store.busy()).toBe(false);
  });
});
