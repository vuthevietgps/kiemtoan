import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { CustomerOption, TasksApi, UserOption } from '../../tasks/data-access/tasks.api';
import {
  CalendarApi,
  CalendarDay,
  CalendarEventsResult,
  CalendarFilters,
  ObligationTypeOption,
} from './calendar.api';

export const EMPTY_FILTERS: CalendarFilters = {
  customerId: null,
  userId: null,
  obligationTypeId: null,
  kind: null,
  status: null,
};

const EMPTY_RESULT: CalendarEventsResult = {
  events: [],
  truncated: false,
  days: [],
  unconfirmedYears: [],
};

/** Trạng thái trang Lịch & Deadline: khoảng ngày đang hiện, bộ lọc, dữ liệu và danh sách chọn. */
@Injectable()
export class CalendarStore {
  private readonly api = inject(CalendarApi);
  private readonly tasksApi = inject(TasksApi);
  private readonly auth = inject(AuthService);
  private request = 0;
  private range: { from: string; to: string } | null = null;

  readonly filters = signal<CalendarFilters>(EMPTY_FILTERS);
  readonly result = signal<CalendarEventsResult>(EMPTY_RESULT);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly customers = signal<CustomerOption[]>([]);
  readonly users = signal<UserOption[]>([]);
  readonly types = signal<ObligationTypeOption[]>([]);

  /** Lọc nhân viên chỉ có ý nghĩa với người xem được việc của người khác. */
  readonly canFilterUser = computed(() => this.auth.permissions().has('tasks:approve'));
  readonly canSeeObligations = computed(() => this.auth.permissions().has('deadlines:view'));
  readonly days = computed(
    () => new Map<string, CalendarDay>(this.result().days.map((d) => [d.date, d])),
  );

  /** FullCalendar báo khoảng mới mỗi lần đổi tháng/tuần; bỏ qua khi không đổi để tránh tải lặp. */
  setRange(from: string, to: string): void {
    if (this.range?.from === from && this.range.to === to) return;
    this.range = { from, to };
    void this.load();
  }

  setFilters(filters: CalendarFilters): void {
    this.filters.set(filters);
    void this.load();
  }

  async load(): Promise<void> {
    if (!this.range) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.api.events(this.range.from, this.range.to, this.filters()),
      );
      if (request === this.request) this.result.set(result);
    } catch (error) {
      if (request === this.request) this.error.set(errorMessage(error));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  /** Danh sách chọn cho bộ lọc; lỗi ở đây không chặn lịch. */
  async loadOptions(): Promise<void> {
    const [customers, users, types] = await Promise.allSettled([
      firstValueFrom(this.tasksApi.customerOptions()),
      this.canFilterUser() ? firstValueFrom(this.tasksApi.userOptions()) : Promise.resolve([]),
      this.canSeeObligations() ? firstValueFrom(this.api.obligationTypes()) : Promise.resolve([]),
    ]);
    if (customers.status === 'fulfilled') this.customers.set(customers.value);
    if (users.status === 'fulfilled') this.users.set(users.value);
    if (types.status === 'fulfilled') this.types.set(types.value);
  }
}
