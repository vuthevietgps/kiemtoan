import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  ContractPlansApi,
  PlanHeaderChange,
  PlanLine,
  PlanPreviewStep,
  PlanStepChange,
} from './contract-plans.api';
import { ContractsApi, UserOption } from './contracts.api';

/** Chờ người dùng ngừng gõ rồi mới xin lịch xem trước. */
const PREVIEW_DELAY_MS = 300;
/** Kỳ hợp lệ như API; kỳ đang gõ dở thì chưa xem trước. */
const PERIOD = /^\d{4}(-(0[1-9]|1[0-2])|-Q[1-4])?$/;

/**
 * Kế hoạch thực hiện các dòng dịch vụ của một HĐ. Thay đổi giữ ở `changes`/`headers` cho tới khi lưu,
 * lịch xem trước lấy từ API sau mỗi thay đổi; lưu gửi kèm revision, lỗi 409 hiển thị để tải lại.
 */
@Injectable()
export class ContractPlansStore {
  private readonly api = inject(ContractPlansApi);
  private readonly contractsApi = inject(ContractsApi);
  private contractId = '';
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Tăng mỗi lần tải lại để bỏ kết quả xem trước đến muộn. */
  private generation = 0;
  readonly lines = signal<PlanLine[]>([]);
  readonly users = signal<UserOption[]>([]);
  /** Thay đổi bước chưa lưu: planId → stepKey → thay đổi. */
  readonly changes = signal<Record<string, Record<string, PlanStepChange>>>({});
  /** Thay đổi chung chưa lưu (ngày bắt đầu, kỳ, ghi chú) theo kế hoạch. */
  readonly headers = signal<Record<string, PlanHeaderChange>>({});
  /** Lịch xem trước theo kế hoạch: planId → stepKey → ngày. */
  readonly previews = signal<Record<string, Record<string, PlanPreviewStep>>>({});
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async load(contractId: string): Promise<void> {
    this.contractId = contractId;
    this.generation++;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.loading.set(true);
    this.error.set('');
    try {
      const [plans, users] = await Promise.all([
        firstValueFrom(this.api.list(contractId)),
        this.users().length ? Promise.resolve(this.users()) : this.fetchUsers(),
      ]);
      this.lines.set(plans.lines);
      this.users.set(users);
      this.changes.set({});
      this.headers.set({});
      this.previews.set({});
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  change(planId: string, stepKey: string, patch: Partial<PlanStepChange>): void {
    this.changes.update((all) => ({
      ...all,
      [planId]: { ...all[planId], [stepKey]: { ...all[planId]?.[stepKey], ...patch, stepKey } },
    }));
    this.schedulePreview(planId);
  }

  changeHeader(planId: string, patch: PlanHeaderChange): void {
    this.headers.update((all) => ({ ...all, [planId]: { ...all[planId], ...patch } }));
    if (
      patch.startDate !== undefined ||
      (patch.period !== undefined && PERIOD.test(patch.period))
    ) {
      this.schedulePreview(planId);
    }
  }

  /** Bỏ mọi thay đổi chưa lưu của một kế hoạch. */
  discard(planId: string): void {
    clearTimeout(this.timers.get(planId));
    this.timers.delete(planId);
    const without = <T>(all: Record<string, T>) =>
      Object.fromEntries(Object.entries(all).filter(([id]) => id !== planId));
    this.changes.update(without);
    this.headers.update(without);
    this.previews.update(without);
  }

  hasChanges(planId: string): boolean {
    return (
      Object.keys(this.changes()[planId] ?? {}).length > 0 ||
      Object.keys(this.headers()[planId] ?? {}).length > 0
    );
  }

  create(lineId: string, workflowVersionId: string | null): Promise<boolean> {
    return this.run(
      this.api.create(this.contractId, lineId, workflowVersionId ? { workflowVersionId } : {}),
    );
  }

  save(planId: string, revision: number): Promise<boolean> {
    return this.run(
      this.api.update(planId, {
        ...this.headers()[planId],
        revision,
        steps: this.stepChanges(planId),
      }),
    );
  }

  confirm(planId: string): Promise<boolean> {
    return this.run(this.api.confirm(planId));
  }

  reopen(planId: string): Promise<boolean> {
    return this.run(this.api.reopen(planId));
  }

  /** Quản trị hệ thống không làm nghiệp vụ, API cũng không nhận làm người thực hiện/kiểm tra. */
  private async fetchUsers(): Promise<UserOption[]> {
    const users = await firstValueFrom(this.contractsApi.userOptions());
    return users.filter((u) => u.role !== 'ADMIN');
  }

  private stepChanges(planId: string): PlanStepChange[] {
    return Object.values(this.changes()[planId] ?? {});
  }

  private schedulePreview(planId: string): void {
    clearTimeout(this.timers.get(planId));
    this.timers.set(
      planId,
      setTimeout(() => void this.preview(planId), PREVIEW_DELAY_MS),
    );
  }

  private async preview(planId: string): Promise<void> {
    this.timers.delete(planId);
    const generation = this.generation;
    const { startDate, period: typed } = this.headers()[planId] ?? {};
    const period = typed && PERIOD.test(typed) ? typed : undefined;
    try {
      const steps = await firstValueFrom(
        this.api.preview(planId, { startDate, period, steps: this.stepChanges(planId) }),
      );
      if (generation !== this.generation) return;
      this.previews.update((all) => ({
        ...all,
        [planId]: Object.fromEntries(steps.map((s) => [s.stepKey, s])),
      }));
      this.error.set('');
    } catch (err) {
      if (generation === this.generation) this.error.set(errorMessage(err));
    }
  }

  private async run(action: Observable<unknown>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(action);
      await this.load(this.contractId);
      return true;
    } catch (err) {
      this.error.set(errorMessage(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
