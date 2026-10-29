import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { WorkflowFilter, WorkflowsApi, WorkflowTemplate } from './workflows.api';

/** Danh sách quy trình mẫu có lọc/phân trang và tạo quy trình mới. */
@Injectable()
export class WorkflowListStore {
  private readonly api = inject(WorkflowsApi);
  private request = 0;
  readonly items = signal<WorkflowTemplate[]>([]);
  readonly total = signal(0);
  readonly filter = signal<WorkflowFilter>({ serviceTypeId: '', search: '', page: 1 });
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await firstValueFrom(this.api.list(this.filter()));
      if (request !== this.request) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  setFilter(patch: Partial<WorkflowFilter>): void {
    this.filter.update((current) => ({ ...current, page: 1, ...patch }));
    void this.load();
  }

  /** Tạo quy trình kèm bản nháp v1; trả về quy trình mới hoặc null nếu lỗi. */
  async create(input: { serviceTypeId: string; name: string }): Promise<WorkflowTemplate | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.error.set('');
    try {
      return await firstValueFrom(this.api.createTemplate(input));
    } catch (err) {
      this.error.set(errorMessage(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
