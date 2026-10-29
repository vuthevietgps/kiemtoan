import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceDetail, InvoiceRecordInput, InvoicesApi } from './invoices.api';
import { DEFAULT_QUERY, InvoicesStore } from './invoices.store';

const detail = (id: string, revision: number, status = 'REQUESTED') =>
  ({ id, revision, status }) as unknown as InvoiceDetail;
const input = { templateCode: '1', symbol: 'C25TAA', number: '1' } as InvoiceRecordInput;

describe('InvoicesStore (08-C)', () => {
  const api = {
    list: vi.fn(),
    detail: vi.fn(),
    request: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    issue: vi.fn(),
    adjust: vi.fn(),
    replace: vi.fn(),
    document: vi.fn(),
  };
  let store: InvoicesStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of({ items: [], total: 3, page: 1, pageSize: 20 }));
    api.detail.mockReturnValue(of(detail('i1', 2)));
    TestBed.configureTestingModule({
      providers: [InvoicesStore, { provide: InvoicesApi, useValue: api }],
    });
    store = TestBed.inject(InvoicesStore);
  });

  it('đổi bộ lọc về trang 1; tải sổ và đếm hàng chờ xuất', async () => {
    store.setQuery({ page: 4 });
    store.setQuery({ status: 'ISSUED', kind: 'ADJUSTMENT' });
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(api.list).toHaveBeenCalledWith({
      ...DEFAULT_QUERY,
      status: 'ISSUED',
      kind: 'ADJUSTMENT',
      page: 1,
    });
    expect(api.list).toHaveBeenCalledWith({ ...DEFAULT_QUERY, pageSize: 1, status: 'REQUESTED' });
    expect(store.queueCount()).toBe(3);
  });

  it('ghi nhận xuất / điều chỉnh / thay thế gửi đúng revision; điều chỉnh mở hoá đơn mới tạo', async () => {
    await store.open('i1');
    api.issue.mockReturnValue(of(detail('i1', 3, 'ISSUED')));
    expect(await store.act({ kind: 'issue', input })).toBe(true);
    expect(api.issue).toHaveBeenCalledWith('i1', 2, input);
    api.adjust.mockReturnValue(of(detail('adj', 1, 'ISSUED')));
    await store.act({ kind: 'adjust', input });
    expect(api.adjust).toHaveBeenCalledWith('i1', 3, input);
    expect(store.detail()?.id).toBe('adj');
  });

  it('409 / lỗi: giữ thông báo, tải lại chi tiết mới nhất; huỷ đề nghị gửi lý do', async () => {
    await store.open('i1');
    api.cancel.mockReturnValue(
      throwError(() => ({ error: { message: 'Hoá đơn vừa được người khác cập nhật' } })),
    );
    api.detail.mockReturnValue(of(detail('i1', 5, 'ISSUED')));
    expect(await store.act({ kind: 'cancel', reason: 'Khách đổi ý' })).toBe(false);
    expect(api.cancel).toHaveBeenCalledWith('i1', 2, 'Khách đổi ý');
    expect(store.actionError()).toBe('Hoá đơn vừa được người khác cập nhật');
    expect(store.detail()?.revision).toBe(5);
    expect(store.busy()).toBe(false);
  });
});
