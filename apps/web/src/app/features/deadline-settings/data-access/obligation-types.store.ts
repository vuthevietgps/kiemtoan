import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  CreateTypeInput,
  DeadlineSettingsApi,
  ObligationType,
  PreviewResult,
  RuleInput,
  SyncSummary,
} from './deadline-settings.api';

/** Danh mục loại nghĩa vụ (I1): soạn, xác nhận, ngừng, gắn dịch vụ, xem trước. */
@Injectable()
export class ObligationTypesStore {
  private readonly api = inject(DeadlineSettingsApi);

  readonly types = signal<ObligationType[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly selectedId = signal<string | null>(null);
  readonly preview = signal<PreviewResult | null>(null);
  readonly selected = computed(
    () => this.types().find((t) => t.id === this.selectedId()) ?? null,
  );

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.types.set(await firstValueFrom(this.api.listTypes()));
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  select(id: string | null): void {
    this.selectedId.set(id);
    this.preview.set(null);
    this.error.set('');
  }

  create(input: CreateTypeInput): Promise<ObligationType | null> {
    return this.run(this.api.createType(input));
  }

  saveDraft(id: string, input: RuleInput, revision?: number) {
    return this.run(this.api.saveDraft(id, input, revision));
  }

  confirm(id: string, revision: number) {
    return this.run(this.api.confirmDraft(id, revision));
  }

  retire(id: string, reason: string) {
    return this.run(this.api.retire(id, reason));
  }

  setServices(id: string, serviceTypeIds: string[]) {
    return this.run(this.api.setServices(id, serviceTypeIds));
  }

  async loadPreview(id: string, customerId: string): Promise<void> {
    this.error.set('');
    try {
      this.preview.set(await firstValueFrom(this.api.preview(id, customerId)));
    } catch (err) {
      this.preview.set(null);
      this.error.set(errorMessage(err));
    }
  }

  /** Ghi một thao tác; thành công thay loại trong danh sách. 409/400 giữ lỗi để hiện. */
  private async run<T extends ObligationType & { synced?: SyncSummary }>(
    action: Observable<T>,
  ): Promise<T | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(action);
      this.types.update((list) =>
        list.some((t) => t.id === result.id)
          ? list.map((t) => (t.id === result.id ? result : t))
          : [...list, result],
      );
      this.preview.set(null);
      return result;
    } catch (err) {
      this.error.set(errorMessage(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
