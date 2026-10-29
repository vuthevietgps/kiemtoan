import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { CalendarYear, DeadlineSettingsApi } from './deadline-settings.api';

export type CalendarDay = CalendarYear['days'][number];

/** Lịch làm việc một năm (I2): sửa danh sách ngày nghỉ/làm bù ở bản tạm rồi lưu; GĐ xác nhận. */
@Injectable()
export class CalendarYearStore {
  private readonly api = inject(DeadlineSettingsApi);
  private request = 0;

  readonly year = signal(new Date().getFullYear());
  readonly data = signal<CalendarYear | null>(null);
  /** Bản đang sửa (chưa lưu). */
  readonly days = signal<CalendarDay[]>([]);
  readonly dirty = signal(false);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async load(year = this.year()): Promise<void> {
    const request = ++this.request;
    this.year.set(year);
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(this.api.calendarYear(year));
      if (request !== this.request) return;
      this.apply(data);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  addDay(day: CalendarDay): void {
    this.days.update((list) => [...list, day].sort((a, b) => a.date.localeCompare(b.date)));
    this.dirty.set(true);
  }

  removeDay(date: string): void {
    this.days.update((list) => list.filter((d) => d.date !== date));
    this.dirty.set(true);
  }

  /** Lưu cả năm; năm đã xác nhận cần lý do (kiểm ở API). Trả số nghĩa vụ đổi hạn. */
  async save(reason?: string): Promise<number | null> {
    const data = this.data();
    return this.run(() =>
      firstValueFrom(this.api.saveYear(this.year(), this.days(), data?.revision ?? null, reason)),
    );
  }

  async confirm(): Promise<number | null> {
    const revision = this.data()?.revision;
    if (!revision) return null;
    return this.run(() => firstValueFrom(this.api.confirmYear(this.year(), revision)));
  }

  private async run(call: () => Promise<CalendarYear>): Promise<number | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await call();
      this.apply(result);
      return result.changedDues ?? 0;
    } catch (err) {
      this.error.set(errorMessage(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  private apply(data: CalendarYear): void {
    this.data.set(data);
    this.days.set(data.days);
    this.dirty.set(false);
  }
}
