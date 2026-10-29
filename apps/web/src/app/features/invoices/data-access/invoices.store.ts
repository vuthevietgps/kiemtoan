import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import type { RecordMode } from '../invoices.text';
import {
  InvoiceBuyer,
  InvoiceDetail,
  InvoiceItem,
  InvoiceQuery,
  InvoiceRecordInput,
  InvoiceRequestInput,
  InvoicesApi,
} from './invoices.api';

export const DEFAULT_QUERY: InvoiceQuery = {
  page: 1,
  pageSize: 20,
  search: '',
  status: null,
  kind: null,
};

/** Thao tác trên một hoá đơn (08 K1–K7); ngăn chi tiết / biểu mẫu phát ra, store gọi API. */
export type InvoiceAction =
  | { kind: 'cancel'; reason: string }
  | { kind: 'buyer'; buyer: Partial<InvoiceBuyer> }
  | { kind: RecordMode; input: InvoiceRecordInput };

/** Trạng thái màn hình Hoá đơn và khối hoá đơn ở chi tiết HĐ (08-C). */
@Injectable()
export class InvoicesStore {
  private readonly api = inject(InvoicesApi);
  private request = 0;

  readonly query = signal<InvoiceQuery>(DEFAULT_QUERY);
  readonly items = signal<InvoiceItem[]>([]);
  readonly total = signal(0);
  readonly queueCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly detail = signal<InvoiceDetail | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal('');

  setQuery(patch: Partial<InvoiceQuery>): void {
    const page = patch.page ?? 1;
    this.query.update((q) => ({ ...q, ...patch, page }));
    void this.load();
  }

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const [list, queue] = await Promise.all([
        firstValueFrom(this.api.list(this.query())),
        firstValueFrom(this.api.list({ ...DEFAULT_QUERY, pageSize: 1, status: 'REQUESTED' })),
      ]);
      if (request !== this.request) return;
      this.items.set(list.items);
      this.total.set(list.total);
      this.queueCount.set(queue.total);
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

  /**
   * Thực hiện thao tác trên hoá đơn đang mở. Điều chỉnh / thay thế mở hoá đơn mới tạo; còn lại tải lại
   * hoá đơn hiện tại. Lỗi (kể cả 409) giữ trong `actionError` và tải lại chi tiết mới nhất.
   */
  async act(action: InvoiceAction): Promise<boolean> {
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
        // Giữ chi tiết cũ khi không tải lại được.
      }
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** Đề nghị xuất (từ chi tiết HĐ); lỗi ném ra để biểu mẫu hiện thông báo. */
  async requestInvoice(input: InvoiceRequestInput): Promise<InvoiceDetail> {
    this.busy.set(true);
    try {
      return await firstValueFrom(this.api.request(input));
    } finally {
      this.busy.set(false);
    }
  }

  exportInvoices(): Observable<Blob> {
    return this.api.exportInvoices(this.query());
  }

  downloadDocument(id: string): Observable<Blob> {
    return this.api.document(id);
  }

  private call(invoice: InvoiceDetail, action: InvoiceAction): Observable<InvoiceDetail> {
    const { id, revision } = invoice;
    switch (action.kind) {
      case 'cancel':
        return this.api.cancel(id, revision, action.reason);
      case 'buyer':
        return this.api.update(id, revision, action.buyer);
      case 'issue':
        return this.api.issue(id, revision, action.input);
      case 'adjust':
        return this.api.adjust(id, revision, action.input);
      case 'replace':
        return this.api.replace(id, revision, action.input);
    }
  }
}
