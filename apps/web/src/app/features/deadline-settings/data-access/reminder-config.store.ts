import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  DeadlineSettingsApi,
  Delivery,
  DeliveryQuery,
  ReminderSettings,
  ServiceThreshold,
} from './deadline-settings.api';

export const DEFAULT_DELIVERY_QUERY: DeliveryQuery = {
  page: 1,
  pageSize: 20,
  status: null,
  channel: null,
  search: '',
};

/** Cấu hình nhắc việc (I9/I11) và nhật ký gửi (I12). */
@Injectable()
export class ReminderConfigStore {
  private readonly api = inject(DeadlineSettingsApi);
  private request = 0;

  readonly settings = signal<ReminderSettings | null>(null);
  readonly thresholds = signal<ServiceThreshold[]>([]);
  readonly query = signal<DeliveryQuery>(DEFAULT_DELIVERY_QUERY);
  readonly deliveries = signal<Delivery[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async loadSettings(): Promise<void> {
    this.error.set('');
    try {
      const [settings, thresholds] = await Promise.all([
        firstValueFrom(this.api.reminderSettings()),
        firstValueFrom(this.api.serviceThresholds()),
      ]);
      this.settings.set(settings);
      this.thresholds.set(thresholds);
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  async saveSettings(input: Omit<ReminderSettings, 'revision'>): Promise<boolean> {
    const revision = this.settings()?.revision ?? 1;
    const saved = await this.run(this.api.saveReminderSettings({ ...input, revision }));
    if (saved) this.settings.set(saved);
    else void this.reloadSettingsKeepError();
    return !!saved;
  }

  async setThresholds(serviceTypeId: string, thresholds: number[]): Promise<boolean> {
    const ok = !!(await this.run(this.api.setServiceThresholds(serviceTypeId, thresholds)));
    if (ok) this.thresholds.set(await firstValueFrom(this.api.serviceThresholds()));
    return ok;
  }

  async removeThresholds(serviceTypeId: string): Promise<boolean> {
    const ok = !!(await this.run(this.api.removeServiceThresholds(serviceTypeId)));
    if (ok) this.thresholds.update((list) => list.filter((t) => t.serviceTypeId !== serviceTypeId));
    return ok;
  }

  runNow() {
    return this.run(this.api.runReminders());
  }

  setQuery(patch: Partial<DeliveryQuery>): void {
    this.query.update((q) => ({ ...q, ...patch, page: patch.page ?? 1 }));
    void this.loadDeliveries();
  }

  async loadDeliveries(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    try {
      const page = await firstValueFrom(this.api.deliveries(this.query()));
      if (request !== this.request) return;
      this.deliveries.set(page.items);
      this.total.set(page.total);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  async retry(id: string): Promise<boolean> {
    const ok = !!(await this.run(this.api.retryDelivery(id)));
    if (ok) void this.loadDeliveries();
    return ok;
  }

  private async run<T>(action: Observable<T>): Promise<T | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.error.set('');
    try {
      return await firstValueFrom(action);
    } catch (err) {
      this.error.set(errorMessage(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  /** Sau 409 tải lại cấu hình mới nhất nhưng giữ thông báo lỗi. */
  private async reloadSettingsKeepError(): Promise<void> {
    const error = this.error();
    await this.loadSettings();
    this.error.set(error);
  }
}
