import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../core/auth/auth.service';
import { toDateKey } from '../../../shared/utils/date-key';
import { CalendarDay, CalendarYearStore } from '../data-access/calendar-year.store';
import { DAY_KIND_LABELS, SETTINGS_TEXT } from '../deadline-settings.text';

/**
 * Tab "Lịch năm" (I2): thêm/xoá ngày nghỉ và ngày làm bù của một năm, lưu, GĐ xác nhận. Năm đã xác
 * nhận sửa cần lý do; API tính lại hạn pháp lý (I8) và báo số nghĩa vụ đổi hạn.
 */
@Component({
  selector: 'app-business-calendar-panel',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [CalendarYearStore],
  templateUrl: './business-calendar.panel.html',
  styleUrl: './business-calendar.panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessCalendarPanel implements OnInit {
  protected readonly store = inject(CalendarYearStore);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  protected readonly text = SETTINGS_TEXT;
  protected readonly kinds = Object.entries(DAY_KIND_LABELS);
  protected readonly kindLabels = DAY_KIND_LABELS;
  protected readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);
  protected readonly canEdit = computed(() => this.auth.can('deadlines:create'));
  protected readonly canApprove = computed(() => this.auth.can('deadlines:approve'));
  protected readonly confirmed = computed(() => this.store.data()?.status === 'CONFIRMED');
  /** Sửa năm đã xác nhận chỉ GĐ (deadlines:approve) và cần lý do. */
  protected readonly editable = computed(() =>
    this.confirmed() ? this.canApprove() : this.canEdit(),
  );

  protected readonly newDate = signal<Date | null>(null);
  protected readonly newKind = signal<CalendarDay['kind']>('DAY_OFF');
  protected readonly newName = signal('');
  protected readonly reason = signal('');
  protected readonly dayError = signal('');

  ngOnInit(): void {
    void this.store.load();
  }

  protected changeYear(year: number): void {
    this.resetNew();
    void this.store.load(year);
  }

  protected add(): void {
    const picked = this.newDate();
    const date = picked ? toDateKey(picked) : '';
    const name = this.newName().trim();
    if (!date.startsWith(`${this.store.year()}-`) || name.length < 2) {
      this.dayError.set(this.text.dayError);
      return;
    }
    if (this.store.days().some((d) => d.date === date)) {
      this.dayError.set(this.text.duplicateDay);
      return;
    }
    this.store.addDay({ date, kind: this.newKind(), name });
    this.resetNew();
  }

  protected canSave(): boolean {
    if (!this.store.dirty() || this.store.busy()) return false;
    const n = this.reason().trim().length;
    return !this.confirmed() || (n >= 5 && n <= 500);
  }

  protected async save(): Promise<void> {
    const changed = await this.store.save(this.confirmed() ? this.reason().trim() : undefined);
    if (changed === null) return;
    this.reason.set('');
    this.message.success(`${this.text.saved}${this.text.changedDues(changed)}`);
  }

  protected async confirm(): Promise<void> {
    const changed = await this.store.confirm();
    if (changed !== null)
      this.message.success(`${this.text.yearConfirmed}${this.text.changedDues(changed)}`);
  }

  /** Chỉ chọn được ngày trong năm đang sửa. */
  protected readonly outsideYear = (d: Date): boolean => d.getFullYear() !== this.store.year();

  protected weekday(date: string): string {
    return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(`${date}T00:00:00`).getDay()];
  }

  private resetNew(): void {
    this.newDate.set(null);
    this.newName.set('');
    this.dayError.set('');
  }
}
