import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  PriceList,
  PriceListInput,
  ServiceCatalogApi,
  ServiceType,
  ServiceTypeFilter,
  ServiceTypeInput,
} from './service-catalog.api';

/** Danh sách dịch vụ theo bộ lọc; bỏ kết quả cũ khi có lần tải mới hơn. */
@Injectable()
export class ServiceCatalogStore {
  private readonly api = inject(ServiceCatalogApi);
  private request = 0;
  readonly items = signal<ServiceType[]>([]);
  readonly filter = signal<ServiceTypeFilter>({ active: '', search: '' });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saveError = signal('');

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const items = await firstValueFrom(this.api.list(this.filter()));
      if (request === this.request) this.items.set(items);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  setFilter(patch: Partial<ServiceTypeFilter>): void {
    this.filter.update((current) => ({ ...current, ...patch }));
    void this.load();
  }

  /** Lưu dịch vụ; trả về false nếu lỗi hoặc đang lưu. */
  async save(existing: ServiceType | null, input: ServiceTypeInput): Promise<boolean> {
    if (this.saving()) return false;
    this.saving.set(true);
    this.saveError.set('');
    try {
      const saved$ = existing ? this.api.update(existing.id, input) : this.api.create(input);
      await firstValueFrom(saved$);
      await this.load();
      return true;
    } catch (err) {
      this.saveError.set(errorMessage(err));
      return false;
    } finally {
      this.saving.set(false);
    }
  }
}

/** Bảng giá của một dịch vụ; chặn thao tác lặp khi đang lưu/xoá. */
@Injectable()
export class PriceListsStore {
  private readonly api = inject(ServiceCatalogApi);
  private request = 0;
  readonly lists = signal<PriceList[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async load(serviceId: string): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const lists = await firstValueFrom(this.api.priceLists(serviceId));
      if (request === this.request) this.lists.set(lists);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  save(serviceId: string, id: string | null, input: PriceListInput): Promise<boolean> {
    return this.perform(
      serviceId,
      id ? this.api.updatePriceList(serviceId, id, input) : this.api.createPriceList(serviceId, input),
    );
  }

  remove(serviceId: string, id: string): Promise<boolean> {
    return this.perform(serviceId, this.api.removePriceList(serviceId, id));
  }

  private async perform(serviceId: string, action: Observable<unknown>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(action);
      await this.load(serviceId);
      return true;
    } catch (err) {
      this.error.set(errorMessage(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
