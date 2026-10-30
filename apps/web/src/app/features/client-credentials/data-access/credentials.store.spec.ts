import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientCredentialsApi, CredentialDetail } from './client-credentials.api';
import { CredentialsStore, DEFAULT_QUERY } from './credentials.store';

const detail = (revision: number, custody = 'OFFICE') =>
  ({ id: 'k1', revision, custody, history: [] }) as unknown as CredentialDetail;

describe('CredentialsStore (09-D)', () => {
  const api = {
    list: vi.fn(),
    detail: vi.fn(),
    accessLog: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    command: vi.fn(),
  };
  let store: CredentialsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of({ items: [], total: 2, page: 1, pageSize: 20 }));
    api.detail.mockReturnValue(of(detail(3)));
    TestBed.configureTestingModule({
      providers: [CredentialsStore, { provide: ClientCredentialsApi, useValue: api }],
    });
    store = TestBed.inject(CredentialsStore);
  });

  it('đổi tab về trang 1, bỏ lọc cũ nhưng giữ KH; đếm cảnh báo hết hạn / chưa rõ nơi giữ', async () => {
    store.setQuery({ customerId: 'c1', status: 'ERROR', page: 3 });
    store.setKind('TOKEN');
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    expect(store.query()).toEqual({ ...DEFAULT_QUERY, kind: 'TOKEN', customerId: 'c1' });
    expect(api.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 1,
      customerId: 'c1',
      expiring: true,
    });
    expect(api.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 1,
      customerId: 'c1',
      kind: 'TOKEN',
      custody: 'UNKNOWN',
    });
    expect(store.expiringCount()).toBe(2);
    expect(store.unknownCount()).toBe(2);
  });

  it('mượn / sửa gửi đúng revision; xoá gửi lý do rồi đóng ngăn', async () => {
    await store.open('k1');
    api.command.mockReturnValue(of(detail(4, 'LOANED')));
    expect(await store.act({ kind: 'borrow', dueDate: '2026-11-02', purpose: null })).toBe(true);
    expect(api.command).toHaveBeenCalledWith('k1', 'borrow', {
      revision: 3,
      dueDate: '2026-11-02',
      purpose: null,
    });
    api.update.mockReturnValue(of(detail(5)));
    await store.act({ kind: 'update', input: { label: 'X' } });
    expect(api.update).toHaveBeenCalledWith('k1', { label: 'X', revision: 4 });
    api.remove.mockReturnValue(of({ id: 'k1' }));
    expect(await store.act({ kind: 'delete', reason: 'Hết dùng' })).toBe(true);
    expect(api.remove).toHaveBeenCalledWith('k1', 5, 'Hết dùng');
    expect(store.detail()).toBeNull();
  });

  it('409 bản cũ: giữ lỗi và tải lại chi tiết mới nhất', async () => {
    await store.open('k1');
    api.command.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'Tài khoản đã được người khác cập nhật, tải lại để xem' },
          }),
      ),
    );
    api.detail.mockReturnValue(of(detail(9, 'LOANED')));
    expect(await store.act({ kind: 'borrow', dueDate: '2026-11-02', purpose: null })).toBe(false);
    expect(store.actionError()).toContain('người khác cập nhật');
    expect(store.detail()?.revision).toBe(9);
  });
});
