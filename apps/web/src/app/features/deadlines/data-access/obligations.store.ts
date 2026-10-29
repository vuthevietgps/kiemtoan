import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  Obligation,
  ObligationDetail,
  ObligationQuery,
  ObligationsApi,
  ObligationSetting,
  ObligationSummary,
  SettingResult,
} from './obligations.api';

export const DEFAULT_QUERY: ObligationQuery = {
  page: 1,
  pageSize: 20,
  search: '',
  status: null,
  obligationTypeId: null,
  ownerId: null,
  customerId: null,
};

/** Thao tác trên một nghĩa vụ (I7); ngăn chi tiết phát ra, store gọi API. */
export type ObligationAction =
  | { kind: 'prepare'; note?: string }
  | { kind: 'file'; filedAt: string; file: File; note?: string }
  | { kind: 'notApplicable'; reason: string }
  | { kind: 'reopen'; reason: string };

const EMPTY_SUMMARY: ObligationSummary = { notDue: 0, preparing: 0, overdue: 0, filedThisMonth: 0 };

/** Trạng thái màn hình Lịch báo cáo và tab Lịch báo cáo của KH. */
@Injectable()
export class ObligationsStore {
  private readonly api = inject(ObligationsApi);
  private request = 0;

  readonly query = signal<ObligationQuery>(DEFAULT_QUERY);
  readonly items = signal<Obligation[]>([]);
  readonly total = signal(0);
  readonly summary = signal<ObligationSummary>(EMPTY_SUMMARY);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly detail = signal<ObligationDetail | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal('');
  readonly settings = signal<ObligationSetting[]>([]);

  setQuery(patch: Partial<ObligationQuery>): void {
    // Đổi bộ lọc thì về trang 1; chỉ đổi trang thì giữ bộ lọc.
    const page = patch.page ?? 1;
    this.query.update((q) => ({ ...q, ...patch, page }));
    void this.load();
  }

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const [list, summary] = await Promise.all([
        firstValueFrom(this.api.list(this.query())),
        firstValueFrom(this.api.summary(this.query())),
      ]);
      if (request !== this.request) return;
      this.items.set(list.items);
      this.total.set(list.total);
      this.summary.set(summary);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  async open(id: string): Promise<void> {
    this.actionError.set('');
    try {
      this.detail.set(await firstValueFrom(this.api.detail(id)));
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  close(): void {
    this.detail.set(null);
    this.actionError.set('');
  }

  /** Thực hiện thao tác; thành công tải lại bảng/ô đếm; lỗi (kể cả 409) tải lại chi tiết, giữ thông báo. */
  async act(action: ObligationAction): Promise<boolean> {
    const current = this.detail();
    if (!current || this.busy()) return false;
    this.busy.set(true);
    this.actionError.set('');
    try {
      this.detail.set(await firstValueFrom(this.call(current, action)));
      void this.load();
      return true;
    } catch (err) {
      this.actionError.set(errorMessage(err));
      try {
        this.detail.set(await firstValueFrom(this.api.detail(current.id)));
      } catch {
        // Giữ chi tiết cũ khi không tải lại được; lỗi đã hiện ở trên.
      }
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async loadSettings(customerId: string): Promise<void> {
    try {
      this.settings.set(await firstValueFrom(this.api.settings(customerId)));
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  async setSetting(
    customerId: string,
    typeId: string,
    enabled: boolean,
    reason: string,
  ): Promise<SettingResult | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.actionError.set('');
    try {
      const result = await firstValueFrom(this.api.setSetting(customerId, typeId, enabled, reason));
      this.settings.set(result.settings);
      void this.load();
      return result;
    } catch (err) {
      this.actionError.set(errorMessage(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  downloadReceipt(documentId: string): Observable<Blob> {
    return this.api.receipt(documentId);
  }

  private call(o: ObligationDetail, action: ObligationAction): Observable<ObligationDetail> {
    switch (action.kind) {
      case 'prepare':
        return this.api.prepare(o.id, o.revision, action.note);
      case 'file':
        return this.api.file(o.id, o.revision, action.filedAt, action.file, action.note);
      case 'notApplicable':
        return this.api.notApplicable(o.id, o.revision, action.reason);
      case 'reopen':
        return this.api.reopen(o.id, o.revision, action.reason);
    }
  }
}
