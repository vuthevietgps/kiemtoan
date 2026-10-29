import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentsApi, ReceivableItem } from './payments.api';
import { groupByCustomer, ReceivablesStore } from './receivables.store';

const aging = (notDue: string, overdue = '0') => ({
  notDue,
  '0-30': overdue,
  '31-60': '0',
  '61-90': '0',
  '>90': '0',
});
const item = (code: string, customerId: string, remaining: string, overdue: string) =>
  ({
    contractId: code,
    code,
    customer: { id: customerId, name: `KH ${customerId}` },
    remaining,
    overdueAmount: overdue,
    pendingAmount: '0',
    aging: aging(String(Number(remaining) - Number(overdue)), overdue),
    installments: [],
  }) as unknown as ReceivableItem;

describe('ReceivablesStore (07-D1)', () => {
  const api = { receivables: vi.fn(), dueInstallments: vi.fn(), exportReceivables: vi.fn() };
  let store: ReceivablesStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.receivables.mockReturnValue(of({ items: [], summary: {} }));
    api.dueInstallments.mockReturnValue(of({ items: [{ id: 'i1' }], total: '600000' }));
    TestBed.configureTestingModule({
      providers: [ReceivablesStore, { provide: PaymentsApi, useValue: api }],
    });
    store = TestBed.inject(ReceivablesStore);
  });

  it('gom HĐ theo KH, cộng còn phải thu / quá hạn / tuổi nợ; KH quá hạn nhiều lên trước', () => {
    const groups = groupByCustomer([
      item('HD-1', 'a', '100', '0'),
      item('HD-2', 'b', '300', '50'),
      item('HD-3', 'a', '200', '120'),
    ]);
    expect(groups.map((g) => g.customer.id)).toEqual(['a', 'b']);
    expect(groups[0]).toMatchObject({ remaining: 300, overdueAmount: 120 });
    expect(groups[0].aging).toMatchObject({ notDue: 180, '0-30': 120 });
    expect(groups[0].contracts.map((c) => c.code)).toEqual(['HD-1', 'HD-3']);
  });

  it('khối công nợ của KH tải theo customerId', async () => {
    store.setQuery({ customerId: 'k1' });
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(api.receivables).toHaveBeenCalledWith({ search: '', customerId: 'k1' });
  });

  it('đợt quá hạn không gửi số ngày; sắp đến hạn gửi số ngày đã chọn', async () => {
    store.setDue('overdue');
    await vi.waitFor(() => expect(store.dueTotal()).toBe('600000'));
    expect(api.dueInstallments).toHaveBeenLastCalledWith({
      search: '',
      customerId: null,
      due: 'overdue',
      days: undefined,
    });
    store.setDue('upcoming', 30);
    await vi.waitFor(() => expect(api.dueInstallments).toHaveBeenCalledTimes(2));
    expect(api.dueInstallments).toHaveBeenLastCalledWith(
      expect.objectContaining({ due: 'upcoming', days: 30 }),
    );
    expect(store.dueItems()).toEqual([{ id: 'i1' }]);
  });
});
