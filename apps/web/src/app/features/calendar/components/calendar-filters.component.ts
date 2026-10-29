import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import type { CustomerOption, UserOption } from '../../tasks/data-access/tasks.api';
import type { CalendarFilters, ObligationTypeOption } from '../data-access/calendar.api';
import { EMPTY_FILTERS } from '../data-access/calendar.store';
import {
  CALENDAR_TEXT,
  CalendarKindFilter,
  CalendarStatusFilter,
  KIND_LABELS,
  STATUS_FILTER_LABELS,
} from '../calendar.text';

/** Bộ lọc lịch (I14): khách hàng, nhân viên, loại báo cáo, loại hạn, trạng thái. */
@Component({
  selector: 'app-calendar-filters',
  imports: [FormsModule, NzSelectModule, NzButtonModule],
  templateUrl: './calendar-filters.component.html',
  styleUrl: './calendar-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarFiltersComponent {
  readonly filters = input.required<CalendarFilters>();
  readonly customers = input<CustomerOption[]>([]);
  readonly users = input<UserOption[]>([]);
  readonly types = input<ObligationTypeOption[]>([]);
  readonly showUser = input(false);
  readonly showTypes = input(false);
  readonly filtersChange = output<CalendarFilters>();

  protected readonly text = CALENDAR_TEXT;
  protected readonly kinds = Object.entries(KIND_LABELS) as [CalendarKindFilter, string][];
  protected readonly statuses = Object.entries(STATUS_FILTER_LABELS) as [
    CalendarStatusFilter,
    string,
  ][];

  protected set<K extends keyof CalendarFilters>(key: K, value: CalendarFilters[K] | undefined) {
    this.filtersChange.emit({ ...this.filters(), [key]: value ?? null });
  }

  protected hasAny(): boolean {
    return Object.values(this.filters()).some((v) => v !== null);
  }

  protected reset(): void {
    this.filtersChange.emit(EMPTY_FILTERS);
  }
}
