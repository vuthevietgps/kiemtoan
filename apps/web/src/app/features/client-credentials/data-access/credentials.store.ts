import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import type { CredentialStatus } from '../../customers/customer-labels';
import type { CredentialKind } from '../client-credentials.text';
import {
  ClientCredential,
  ClientCredentialsApi,
  CredentialDetail,
  CredentialEvent,
  CredentialInput,
  CredentialQuery,
} from './client-credentials.api';

export const DEFAULT_QUERY: CredentialQuery = {
  page: 1,
  pageSize: 20,
  kind: 'ACCOUNT',
  search: '',
};

/** Thao tác trên tài khoản đang mở (09 L4, L5, L7, L10); store gửi kèm `revision`. */
export type CredentialAction =
  | { kind: 'update'; input: CredentialInput }
  | { kind: 'report'; status: Exclude<CredentialStatus, 'ACTIVE'>; note: string }
  | { kind: 'borrow'; dueDate: string; purpose: string | null }
  | { kind: 'return'; storageLocation: string | null; note: string | null }
  | { kind: 'handOver'; holderId: string; dueDate: string; purpose: string | null }
  | {
      kind: 'custody';
      custody: 'OFFICE' | 'CUSTOMER';
      storageLocation: string | null;
      note: string | null;
    }
  | { kind: 'delete'; reason: string };

/** Trạng thái màn hình kho tài khoản và tab Tài khoản của KH360 (09-D). */
@Injectable()
export class CredentialsStore {
  private readonly api = inject(ClientCredentialsApi);
  private request = 0;

  readonly query = signal<CredentialQuery>(DEFAULT_QUERY);
  readonly items = signal<ClientCredential[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  /** Cảnh báo đầu trang: hết hạn trong 30 ngày, token chưa xác định nơi giữ. */
  readonly expiringCount = signal(0);
  readonly unknownCount = signal(0);
  readonly detail = signal<CredentialDetail | null>(null);
  readonly accessLog = signal<CredentialEvent[] | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal('');

  setQuery(patch: Partial<CredentialQuery>): void {
    const page = patch.page ?? 1;
    this.query.update((q) => ({ ...q, ...patch, page }));
    void this.load();
  }

  setKind(kind: CredentialKind): void {
    const { customerId, pageSize } = this.query();
    this.query.set({ ...DEFAULT_QUERY, kind, customerId, pageSize });
    void this.load();
  }

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    const customerId = this.query().customerId;
    const count = (extra: Partial<CredentialQuery>) =>
      firstValueFrom(this.api.list({ page: 1, pageSize: 1, customerId, ...extra }));
    try {
      const [list, expiring, unknown] = await Promise.all([
        firstValueFrom(this.api.list(this.query())),
        count({ expiring: true }),
        count({ kind: 'TOKEN', custody: 'UNKNOWN' }),
      ]);
      if (request !== this.request) return;
      this.items.set(list.items);
      this.total.set(list.total);
      this.expiringCount.set(expiring.total);
      this.unknownCount.set(unknown.total);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  async open(id: string): Promise<void> {
    this.actionError.set('');
    this.accessLog.set(null);
    try {
      this.detail.set(await firstValueFrom(this.api.detail(id)));
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  close(): void {
    this.detail.set(null);
    this.accessLog.set(null);
    this.actionError.set('');
  }

  async loadAccessLog(): Promise<void> {
    const current = this.detail();
    if (!current) return;
    try {
      this.accessLog.set((await firstValueFrom(this.api.accessLog(current.id))).items);
    } catch (err) {
      this.actionError.set(errorMessage(err));
    }
  }

  /** Thêm mới rồi mở chi tiết; lỗi ném ra để biểu mẫu hiện. */
  async create(input: CredentialInput): Promise<void> {
    this.busy.set(true);
    try {
      this.detail.set(await firstValueFrom(this.api.create(input)));
      this.actionError.set('');
      void this.load();
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Thao tác trên tài khoản đang mở. Lỗi (kể cả 409 bản cũ) giữ ở `actionError` và tải lại chi tiết mới
   * nhất; xoá thành công thì đóng ngăn.
   */
  async act(action: CredentialAction): Promise<boolean> {
    const current = this.detail();
    if (!current || this.busy()) return false;
    this.busy.set(true);
    this.actionError.set('');
    try {
      if (action.kind === 'delete') {
        await firstValueFrom(this.api.remove(current.id, current.revision, action.reason));
        this.close();
      } else {
        this.detail.set(await firstValueFrom(this.call(current, action)));
        if (this.accessLog()) void this.loadAccessLog();
      }
      void this.load();
      return true;
    } catch (err) {
      this.actionError.set(errorMessage(err));
      try {
        this.detail.set(await firstValueFrom(this.api.detail(current.id)));
      } catch {
        // Giữ chi tiết cũ khi không tải lại được.
      }
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private call(
    c: CredentialDetail,
    action: Exclude<CredentialAction, { kind: 'delete' }>,
  ): Observable<CredentialDetail> {
    const { id, revision } = c;
    const { kind, ...body } = action;
    switch (kind) {
      case 'update':
        return this.api.update(id, { ...action.input, revision });
      case 'report':
        return this.api.command(id, 'report-issue', { revision, ...body });
      case 'borrow':
        return this.api.command(id, 'borrow', { revision, ...body });
      case 'return':
        return this.api.command(id, 'return', { revision, ...body });
      case 'handOver':
        return this.api.command(id, 'hand-over', { revision, ...body });
      case 'custody':
        return this.api.command(id, 'custody', { revision, ...body });
    }
  }
}
