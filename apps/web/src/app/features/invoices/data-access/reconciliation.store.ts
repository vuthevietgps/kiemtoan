import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { InvoicesApi, Reconciliation, ReconciliationQuery } from './invoices.api';

/** Trạng thái tab Đối chiếu thu – xuất (08-D, K8). */
@Injectable()
export class ReconciliationStore {
  private readonly api = inject(InvoicesApi);
  private request = 0;

  readonly query = signal<ReconciliationQuery>({ search: '', mismatchOnly: false, to: null });
  readonly data = signal<Reconciliation | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  setQuery(patch: Partial<ReconciliationQuery>): void {
    this.query.update((q) => ({ ...q, ...patch }));
    void this.load();
  }

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(this.api.reconciliation(this.query()));
      if (request === this.request) this.data.set(data);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  exportFile(): Observable<Blob> {
    return this.api.exportReconciliation(this.query());
  }
}
