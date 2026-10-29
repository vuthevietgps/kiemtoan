import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoicesApi } from './invoices.api';
import { ReconciliationStore } from './reconciliation.store';

describe('ReconciliationStore (08-D)', () => {
  const api = { reconciliation: vi.fn(), exportReconciliation: vi.fn() };
  let store: ReconciliationStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.reconciliation.mockReturnValue(of({ items: [], summary: { paidNotInvoiced: '0' } }));
    TestBed.configureTestingModule({
      providers: [ReconciliationStore, { provide: InvoicesApi, useValue: api }],
    });
    store = TestBed.inject(ReconciliationStore);
  });

  it('giữ bộ lọc khi đổi từng điều kiện: đến ngày, chỉ HĐ chênh lệch; xuất Excel cùng bộ lọc', async () => {
    store.setQuery({ to: '2026-06-30' });
    store.setQuery({ mismatchOnly: true });
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(api.reconciliation).toHaveBeenLastCalledWith({
      search: '',
      to: '2026-06-30',
      mismatchOnly: true,
    });
    store.exportFile();
    expect(api.exportReconciliation).toHaveBeenCalledWith({
      search: '',
      to: '2026-06-30',
      mismatchOnly: true,
    });
  });
});
