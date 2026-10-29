import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { UrgencyTagComponent } from '../../tasks/components/urgency-tag.component';
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '../../tasks/task-labels';
import type { CalendarEvent } from '../data-access/calendar.api';
import { CALENDAR_TEXT, OBLIGATION_STATUS_LABELS } from '../calendar.text';

/** Ngăn chi tiết một mục trên lịch: hạn pháp lý (nghĩa vụ) hoặc việc nội bộ. */
@Component({
  selector: 'app-calendar-event-drawer',
  imports: [DatePipe, NzDrawerModule, NzButtonModule, NzTagModule, UrgencyTagComponent],
  templateUrl: './calendar-event-drawer.component.html',
  styleUrl: './calendar-event-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarEventDrawerComponent {
  readonly event = input<CalendarEvent | null>(null);
  readonly closed = output<void>();
  readonly openTask = output<string>();
  readonly openCustomer = output<string>();
  readonly openObligation = output<string>();

  protected readonly text = CALENDAR_TEXT;
  protected readonly taskLabels = TASK_STATUS_LABELS;
  protected readonly taskColors = TASK_STATUS_COLORS;
  protected readonly obligationLabels = OBLIGATION_STATUS_LABELS;
  /** Ngăn toàn chiều rộng ở màn hẹp. */
  protected readonly width = computed(() =>
    typeof window !== 'undefined' && window.innerWidth < 480 ? '100%' : 420,
  );

  protected heading(e: CalendarEvent): string {
    if (e.kind === 'OBLIGATION') return this.text.statutory;
    return e.isStatutory ? this.text.statutoryTask : this.text.internal;
  }
}
