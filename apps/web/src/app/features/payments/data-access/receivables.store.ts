import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  AgingKey,
  AgingTotals,
  DueFilter,
  DueInstallment,
  PaymentsApi,
  ReceivableItem,
  ReceivableQuery,
  Receivables,
} from './payments.api';

export const AGING_ORDER: AgingKey[] = ['notDue', '0-30', '31-60', '61-90', '>90'];

/** Nhóm công nợ theo khách hàng (KH → HĐ → đợt). */
export interface CustomerReceivable {
  customer: { id: string; name: string };
  remaining: number;
  overdueAmount: number;
  pendingAmount: number;
  aging: Record<AgingKey, number>;
  contracts: ReceivableItem[];
}

const zeroAging = (): Record<AgingKey, number> =>
  Object.fromEntries(AGING_ORDER.map((k) => [k, 0])) as Record<AgingKey, number>;

/** Gom HĐ theo KH, cộng còn phải thu / quá hạn / tuổi nợ; KH nợ nhiều nhất lên trước. */
export function groupByCustomer(items: ReceivableItem[]): CustomerReceivable[] {
  const groups = new Map<string, CustomerReceivable>();
  for (const item of items) {
    const group = groups.get(item.customer.id) ?? {
      customer: item.customer,
      remaining: 0,
      overdueAmount: 0,
      pendingAmount: 0,
      aging: zeroAging(),
      contracts: [],
    };
    group.remaining += Number(item.remaining);
    group.overdueAmount += Number(item.overdueAmount);
    group.pendingAmount += Number(item.pendingAmount);
    for (const k of AGING_ORDER) group.aging[k] += Number(item.aging[k]);
    group.contracts.push(item);
    groups.set(item.customer.id, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.overdueAmount - a.overdueAmount || b.remaining - a.remaining,
  );
}

/** Trạng thái tab Công nợ, tab Sắp đến hạn / Quá hạn và khối công nợ ở chi tiết KH (07-D1). */
@Injectable()
export class ReceivablesStore {
  private readonly api = inject(PaymentsApi);
  private request = 0;
  private dueRequest = 0;

  readonly query = signal<ReceivableQuery>({ search: '', customerId: null });
  readonly data = signal<Receivables | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly groups = computed(() => groupByCustomer(this.data()?.items ?? []));
  readonly agingTotals = computed<AgingTotals | null>(() => this.data()?.summary.aging ?? null);

  readonly due = signal<DueFilter>('overdue');
  readonly days = signal(7);
  readonly dueItems = signal<DueInstallment[]>([]);
  readonly dueTotal = signal('0');
  readonly dueLoading = signal(false);

  setQuery(patch: Partial<ReceivableQuery>): void {
    this.query.update((q) => ({ ...q, ...patch }));
    void this.load();
  }

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(this.api.receivables(this.query()));
      if (request === this.request) this.data.set(data);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  setDue(due: DueFilter, days = this.days()): void {
    this.due.set(due);
    this.days.set(days);
    void this.loadDue();
  }

  async loadDue(): Promise<void> {
    const request = ++this.dueRequest;
    this.dueLoading.set(true);
    this.error.set('');
    try {
      const res = await firstValueFrom(
        this.api.dueInstallments({
          ...this.query(),
          due: this.due(),
          days: this.due() === 'upcoming' ? this.days() : undefined,
        }),
      );
      if (request !== this.dueRequest) return;
      this.dueItems.set(res.items);
      this.dueTotal.set(res.total);
    } catch (err) {
      if (request === this.dueRequest) this.error.set(errorMessage(err));
    } finally {
      if (request === this.dueRequest) this.dueLoading.set(false);
    }
  }

  exportReceivables(): Observable<Blob> {
    return this.api.exportReceivables(this.query());
  }
}
