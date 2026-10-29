import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { CustomerDocument } from './customers.api';
import { CustomerDocumentsApi, DocumentQuery, DocumentVersion } from './customer-documents.api';

@Injectable()
export class CustomerDocumentsStore {
  readonly api = inject(CustomerDocumentsApi);
  readonly items = signal<CustomerDocument[]>([]);
  readonly total = signal(0);
  readonly query = signal<DocumentQuery>({page: 1, pageSize: 20});
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly history = signal<DocumentVersion[]>([]);
  readonly historyTotal = signal(0);
  readonly historyPage = signal(1);
  readonly historyId = signal<string | null>(null);
  private loadId = 0;
  private historyLoadId = 0;
  async load(customerId: string) {
    const id = ++this.loadId; this.loading.set(true); this.error.set('');
    try { const result = await firstValueFrom(this.api.list(customerId, this.query())); if (id === this.loadId) { this.items.set(result.items); this.total.set(result.total); } }
    catch (error) { if (id === this.loadId) this.error.set(errorMessage(error)); }
    finally { if (id === this.loadId) this.loading.set(false); }
  }
  async loadHistory(id: string, page = 1) {
    const request = ++this.historyLoadId; this.historyId.set(id); this.historyPage.set(page); this.error.set('');
    try { const result = await firstValueFrom(this.api.versions(id, page)); if (request === this.historyLoadId) { this.history.set(result.items); this.historyTotal.set(result.total); } }
    catch (error) { if (request === this.historyLoadId) this.error.set(errorMessage(error)); }
  }
  async perform(customerId: string, action: Observable<unknown>) {
    if (this.busy()) return false;
    this.busy.set(true); this.error.set('');
    try { await firstValueFrom(action); await this.load(customerId); return true; }
    catch (error) { this.error.set(errorMessage(error)); return false; }
    finally { this.busy.set(false); }
  }
}
