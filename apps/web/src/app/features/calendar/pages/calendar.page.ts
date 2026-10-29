import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';
import type {
  CalendarOptions,
  DatesSetArg,
  DayCellContentArg,
  DayCellMountArg,
  EventClickArg,
} from '@fullcalendar/core';
import viLocale from '@fullcalendar/core/locales/vi';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { dayInfo, dayKey, toCalendarInputs } from '../calendar-events';
import { CALENDAR_TEXT } from '../calendar.text';
import { CalendarEventDrawerComponent } from '../components/calendar-event-drawer.component';
import { CalendarFiltersComponent } from '../components/calendar-filters.component';
import type { CalendarEvent, CalendarFilters } from '../data-access/calendar.api';
import { CalendarStore } from '../data-access/calendar.store';

const NARROW = 768;

/**
 * Lịch & Deadline (06, I14): tháng / tuần / danh sách gộp hạn pháp lý và hạn việc nội bộ; màu theo
 * mức gấp, ngày nghỉ tô xám; bấm mục mở ngăn chi tiết. Màn hẹp mặc định dạng danh sách.
 */
@Component({
  selector: 'app-calendar-page',
  imports: [
    FullCalendarModule,
    NzAlertModule,
    NzSpinModule,
    PageHeaderComponent,
    CalendarFiltersComponent,
    CalendarEventDrawerComponent,
  ],
  providers: [CalendarStore],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  protected readonly store = inject(CalendarStore);
  private readonly router = inject(Router);
  protected readonly text = CALENDAR_TEXT;
  protected readonly selected = signal<CalendarEvent | null>(null);

  private readonly narrow = typeof window !== 'undefined' && window.innerWidth < NARROW;

  protected readonly unconfirmed = computed(() => this.store.result().unconfirmedYears.join(', '));

  /** Cấu hình cố định; chỉ danh sách mục thay đổi theo dữ liệu. */
  private readonly baseOptions: CalendarOptions = {
    plugins: [dayGridPlugin, listPlugin],
    locale: viLocale,
    firstDay: 1,
    initialView: this.narrow ? 'listMonth' : 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek,listMonth',
    },
    buttonText: {
      today: CALENDAR_TEXT.today,
      month: CALENDAR_TEXT.month,
      week: CALENDAR_TEXT.week,
      list: CALENDAR_TEXT.list,
    },
    noEventsText: CALENDAR_TEXT.noEvents,
    height: 'auto',
    dayMaxEvents: 3,
    eventDisplay: 'block',
    // Mọi hạn là cả ngày: bỏ cột giờ "Cả ngày" ở dạng danh sách.
    displayEventTime: false,
    datesSet: (arg: DatesSetArg) => this.onDatesSet(arg),
    eventClick: (arg: EventClickArg) => this.onEventClick(arg),
    dayCellDidMount: (arg: DayCellMountArg) => {
      const name = dayInfo(arg.date, this.store.days()).name;
      if (name) arg.el.title = name;
    },
  };

  protected readonly options = computed<CalendarOptions>(() => ({
    ...this.baseOptions,
    events: toCalendarInputs(this.store.result().events),
    // Tạo lại cùng dữ liệu mới để ô ngày tô lại theo ngày nghỉ vừa tải.
    dayCellClassNames: (arg: DayCellContentArg) =>
      dayInfo(arg.date, this.store.days()).off ? ['cal-day-off'] : [],
  }));

  constructor() {
    void this.store.loadOptions();
  }

  protected onFilters(filters: CalendarFilters): void {
    this.store.setFilters(filters);
  }

  protected openTask(id: string): void {
    void this.router.navigate(['/tasks'], { queryParams: { id } });
  }

  protected openCustomer(id: string): void {
    void this.router.navigate(['/customers', id]);
  }

  protected openObligation(id: string): void {
    void this.router.navigate(['/deadlines'], { queryParams: { id } });
  }

  /** Khoảng FullCalendar trả có `end` không bao gồm → lùi một ngày. */
  private onDatesSet(arg: DatesSetArg): void {
    const end = new Date(arg.end);
    end.setDate(end.getDate() - 1);
    this.store.setRange(dayKey(arg.start), dayKey(end));
  }

  private onEventClick(arg: EventClickArg): void {
    arg.jsEvent.preventDefault();
    this.selected.set(arg.event.extendedProps['source'] as CalendarEvent);
  }
}
