import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  PaymentDetail,
  PaymentInput,
  PaymentItem,
  PaymentPatch,
  PaymentQuery,
  PaymentsApi,
} from './payments.api';

export const DEFAULT_QUERY: PaymentQuery = { page: 1, pageSize: 20, search: '', status: null };

/** Thao tác trên một phiếu (J1–J8); ngăn chi tiết phát ra, store gọi API. */
export type PaymentAction =
  | { kind: 'submit' }
  | { kind: 'withdraw' }
  | { kind: 'approve' }
  | { kind: 'return'; reason: string }
  | { kind: 'cancel'; reason: string }
  | { kind: 'attach'; file: File }
  | { kind: 'detach'; documentId: string };

/** Kết quả lưu phiếu: `submitError` khi đã lưu nháp nhưng gửi duyệt không được (vd. thiếu chứng từ). */
export interface SaveResult {
  id: string;
  submitError?: string;
}

/** Trạng thái màn hình Thu tiền và khối thu tiền trên chi tiết HĐ. */
@Injectable()
export class PaymentsStore {
  private readonly api = inject(PaymentsApi);
  private request = 0;

  readonly query = signal<PaymentQuery>(DEFAULT_QUERY);
  readonly items = signal<PaymentItem[]>([]);
  readonly total = signal(0);
  readonly pendingCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly detail = signal<PaymentDetail | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal('');

  setQuery(patch: Partial<PaymentQuery>): void {
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
      const [list, pending] = await Promise.all([
        firstValueFrom(this.api.list(this.query())),
        firstValueFrom(this.api.list({ ...DEFAULT_QUERY, pageSize: 1, status: 'PENDING' })),
      ]);
      if (request !== this.request) return;
      this.items.set(list.items);
      this.total.set(list.total);
      this.pendingCount.set(pending.total);
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

  /** Thực hiện thao tác; thành công/thất bại (kể cả 409) đều tải lại chi tiết, lỗi giữ trong `actionError`. */
  async act(action: PaymentAction): Promise<boolean> {
    const current = this.detail();
    if (!current || this.busy()) return false;
    this.busy.set(true);
    this.actionError.set('');
    let ok = false;
    try {
      await firstValueFrom(this.call(current, action));
      ok = true;
      void this.load();
    } catch (err) {
      this.actionError.set(errorMessage(err));
    }
    try {
      this.detail.set(await firstValueFrom(this.api.detail(current.id)));
    } catch {
      // Giữ chi tiết cũ khi không tải lại được.
    }
    this.busy.set(false);
    return ok;
  }

  /**
   * Lập phiếu mới (Nháp) hoặc sửa phiếu Nháp/Trả lại, đính kèm file nếu có, rồi gửi duyệt nếu chọn.
   * Lỗi khi lập/sửa ném ra; lỗi khi gửi duyệt trả trong `submitError` (phiếu vẫn được lưu nháp).
   */
  async save(
    input: PaymentInput,
    options: { file?: File | null; submit: boolean; existing?: PaymentDetail | null },
  ): Promise<SaveResult> {
    this.busy.set(true);
    try {
      const { contractId, ...patch } = input;
      const existing = options.existing;
      let id: string;
      let revision: number;
      if (existing) {
        await firstValueFrom(this.api.update(existing.id, existing.revision, patch as PaymentPatch));
        id = existing.id;
        revision = existing.revision + 1;
      } else {
        id = (await firstValueFrom(this.api.create({ ...patch, contractId }))).id;
        revision = 1;
      }
      if (options.file) await firstValueFrom(this.api.attach(id, options.file));
      if (!options.submit) return { id };
      try {
        await firstValueFrom(this.api.submit(id, revision));
        return { id };
      } catch (err) {
        return { id, submitError: errorMessage(err) };
      }
    } finally {
      this.busy.set(false);
      if (this.detail()) void this.open(this.detail()!.id);
    }
  }

  exportPayments(): Observable<Blob> {
    return this.api.exportPayments(this.query());
  }

  downloadDocument(documentId: string): Observable<Blob> {
    return this.api.document(documentId);
  }

  private call(p: PaymentDetail, action: PaymentAction): Observable<unknown> {
    switch (action.kind) {
      case 'submit':
        return this.api.submit(p.id, p.revision);
      case 'withdraw':
        return this.api.withdraw(p.id, p.revision);
      case 'approve':
        return this.api.approve(p.id, p.revision);
      case 'return':
        return this.api.returnPayment(p.id, p.revision, action.reason);
      case 'cancel':
        return this.api.cancel(p.id, p.revision, action.reason);
      case 'attach':
        return this.api.attach(p.id, action.file);
      case 'detach':
        return this.api.detach(p.id, action.documentId);
    }
  }
}
