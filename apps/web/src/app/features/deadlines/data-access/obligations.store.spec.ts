import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObligationDetail, ObligationsApi } from './obligations.api';
import { DEFAULT_QUERY, ObligationsStore } from './obligations.store';

const detail = (revision: number, status = 'NOT_DUE') =>
  ({ id: 'o1', revision, status, displayStatus: status }) as unknown as ObligationDetail;
const summary = { notDue: 1, preparing: 0, overdue: 0, filedThisMonth: 0 };

describe('ObligationsStore (06-D2)', () => {
  const api = {
    list: vi.fn(),
    summary: vi.fn(),
    detail: vi.fn(),
    prepare: vi.fn(),
    file: vi.fn(),
    notApplicable: vi.fn(),
    reopen: vi.fn(),
    settings: vi.fn(),
    setSetting: vi.fn(),
  };
  let store: ObligationsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of({ items: [{ id: 'o1' }], total: 1, page: 1, pageSize: 20 }));
    api.summary.mockReturnValue(of(summary));
    api.detail.mockReturnValue(of(detail(1)));
    TestBed.configureTestingModule({
      providers: [ObligationsStore, { provide: ObligationsApi, useValue: api }],
    });
    store = TestBed.inject(ObligationsStore);
  });

  it('đổi bộ lọc về trang 1 và tải cả bảng lẫn ô đếm cùng bộ lọc; đổi trang giữ bộ lọc', async () => {
    store.setQuery({ page: 3 });
    store.setQuery({ status: 'OVERDUE' });
    await vi.waitFor(() => expect(store.items()).toHaveLength(1));
    const expected = { ...DEFAULT_QUERY, status: 'OVERDUE', page: 1 };
    expect(api.list).toHaveBeenLastCalledWith(expected);
    expect(api.summary).toHaveBeenLastCalledWith(expected);
    expect(store.summary()).toEqual(summary);
    store.setQuery({ page: 2 });
    expect(store.query()).toMatchObject({ status: 'OVERDUE', page: 2 });
  });

  it('thao tác gửi đúng revision; thành công thay chi tiết và tải lại bảng', async () => {
    await store.open('o1');
    api.prepare.mockReturnValue(of(detail(2, 'PREPARING')));
    expect(await store.act({ kind: 'prepare' })).toBe(true);
    expect(api.prepare).toHaveBeenCalledWith('o1', 1, undefined);
    expect(store.detail()?.revision).toBe(2);
    await vi.waitFor(() => expect(api.list).toHaveBeenCalled());
  });

  it('409: giữ thông báo lỗi và tải lại chi tiết mới nhất', async () => {
    await store.open('o1');
    api.notApplicable.mockReturnValue(
      throwError(() => ({ error: { message: 'Nghĩa vụ vừa được người khác cập nhật' } })),
    );
    api.detail.mockReturnValue(of(detail(5, 'FILED')));
    expect(await store.act({ kind: 'notApplicable', reason: 'KH tự nộp' })).toBe(false);
    expect(store.actionError()).toBe('Nghĩa vụ vừa được người khác cập nhật');
    expect(store.detail()?.revision).toBe(5);
    expect(store.busy()).toBe(false);
  });

  it('nộp kèm biên nhận: gửi ngày nộp, file và ghi chú', async () => {
    await store.open('o1');
    const file = new File(['x'], 'bien-nhan.pdf');
    api.file.mockReturnValue(of(detail(2, 'FILED')));
    await store.act({ kind: 'file', filedAt: '2026-10-20', file, note: 'Nộp qua eTax' });
    expect(api.file).toHaveBeenCalledWith('o1', 1, '2026-10-20', file, 'Nộp qua eTax');
  });
});
