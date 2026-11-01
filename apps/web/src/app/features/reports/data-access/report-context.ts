import { computed, Injectable, signal } from '@angular/core';
import { currentYearRange, toDateParam } from '../../dashboard/data-access/format';
import type { SavedFilter } from './saved-filters.api';

/** Link trong thông báo định kỳ: mở bộ lọc đã lưu với kỳ của lượt gửi (M12). */
export interface ScheduledOpen {
  filter: SavedFilter;
  from: string;
  to: string;
}

const toDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Kỳ chung của trang Báo cáo và bộ lọc mở từ thông báo (10-F). Cấp ở `ReportsPage`: thanh bộ lọc đã lưu chỉ
 * hiện khi có ngữ cảnh này.
 */
@Injectable()
export class ReportContext {
  readonly range = signal<Date[]>(currentYearRange());
  readonly from = computed(() => toDateParam(this.range()[0]));
  readonly to = computed(() => toDateParam(this.range()[1]));
  readonly scheduled = signal<ScheduledOpen | null>(null);

  setRange(value: Date[] | null): void {
    this.range.set(value && value.length === 2 ? value : currentYearRange());
  }

  /** Áp dụng kỳ đã lưu; bộ lọc không lưu kỳ thì giữ kỳ đang chọn. */
  setPeriod(from?: string | null, to?: string | null): void {
    if (from && to) this.range.set([toDate(from), toDate(to)]);
  }
}
