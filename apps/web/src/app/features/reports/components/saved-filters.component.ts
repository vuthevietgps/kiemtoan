import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { CanDirective } from '../../../shared/directives/can.directive';
import { saveFile } from '../../deadlines/save-file';
import { vnDate } from '../data-access/print-report';
import { ReportContext } from '../data-access/report-context';
import {
  FilterParams,
  ReportKey,
  SavedFilter,
  SavedFiltersApi,
  ScheduleFrequency,
} from '../data-access/saved-filters.api';

export const SCHEDULE_OPTIONS: { value: ScheduleFrequency; label: string; period: string }[] = [
  { value: 'WEEKLY', label: 'Hằng tuần (thứ 2, 07:30)', period: 'tuần trước' },
  { value: 'MONTHLY', label: 'Hằng tháng (ngày 1, 07:30)', period: 'tháng trước' },
];
const RESULT_TEXT = {
  SENT: 'đã gửi email',
  NOT_EMAILED: 'chưa gửi email, đã báo trong ứng dụng',
  FAILED: 'gửi email thất bại, đã báo trong ứng dụng',
  STOPPED: 'đã dừng',
};

/**
 * Thanh bộ lọc đã lưu của một báo cáo (10-F): chọn để mở lại, lưu mới, cập nhật, xoá, hẹn gửi Excel cho
 * chính mình. Bộ lọc riêng từng người (M11). Kỳ số liệu lượt gửi là kỳ vừa qua, không phải kỳ đã lưu (M12).
 */
@Component({
  selector: 'app-saved-filters',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    CanDirective,
  ],
  templateUrl: './saved-filters.component.html',
  styles: `
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .pick {
      width: 220px;
      max-width: 100%;
    }
    .freq {
      width: 230px;
      max-width: 100%;
    }
    .note {
      color: #6b7280;
      font-size: 12px;
      margin: -4px 0 12px;
    }
    nz-alert {
      margin-bottom: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedFiltersComponent {
  private readonly api = inject(SavedFiltersApi);
  private readonly context = inject(ReportContext);
  private readonly message = inject(NzMessageService);

  readonly report = input.required<ReportKey>();
  /** Tham số riêng của báo cáo đang chọn (không gồm kỳ). */
  readonly params = input<FilterParams>({});
  readonly applied = output<Record<string, string>>();

  protected readonly options = SCHEDULE_OPTIONS;
  protected readonly date = vnDate;
  protected readonly selectedId = signal<string | null>(null);
  protected readonly naming = signal(false);
  protected readonly name = signal('');

  protected readonly filters = rxResource({
    params: () => this.report(),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly selected = computed(
    () => this.filters.value()?.find((f) => f.id === this.selectedId()) ?? null,
  );
  /** Mở từ thông báo định kỳ: kỳ của lượt gửi, có nút tải Excel. */
  protected readonly scheduled = computed(() => {
    const open = this.context.scheduled();
    return open?.filter.report === this.report() ? open : null;
  });
  protected readonly scheduleNote = computed(() => {
    const s = this.selected()?.schedule;
    if (!s?.enabled) return null;
    const period = SCHEDULE_OPTIONS.find((o) => o.value === s.frequency)!.period;
    const last = s.lastResult ? ` Lượt gần nhất: ${RESULT_TEXT[s.lastResult]}.` : '';
    return `Gửi Excel vào email của bạn, số liệu ${period}, theo quyền của bạn tại lúc gửi.${last}`;
  });

  constructor() {
    effect(() => {
      const open = this.scheduled();
      if (open) this.open(open.filter, { from: open.from, to: open.to });
    });
  }

  protected pick(id: string | null): void {
    this.selectedId.set(id);
    const filter = this.selected();
    if (filter) this.open(filter);
  }

  protected startSave(): void {
    this.name.set('');
    this.naming.set(true);
  }

  protected async saveNew(): Promise<void> {
    const name = this.name().trim();
    if (!name) return;
    const saved = await this.run(
      this.api.create(this.report(), name, this.currentParams()),
      'Đã lưu bộ lọc',
    );
    if (!saved) return;
    this.naming.set(false);
    this.filters.reload();
    this.selectedId.set(saved.id);
  }

  protected async update(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    await this.run(this.api.updateParams(id, this.currentParams()), 'Đã cập nhật bộ lọc');
    this.filters.reload();
  }

  protected async remove(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    await this.run(this.api.remove(id), 'Đã xoá bộ lọc');
    this.selectedId.set(null);
    this.filters.reload();
  }

  protected async changeSchedule(frequency: ScheduleFrequency | null): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    await this.run(
      frequency ? this.api.saveSchedule(id, frequency) : this.api.removeSchedule(id),
      frequency ? 'Đã hẹn gửi' : 'Đã bỏ hẹn gửi',
    );
    this.filters.reload();
  }

  protected async downloadScheduled(): Promise<void> {
    const open = this.scheduled();
    if (!open) return;
    const blob = await this.run(
      this.api.exportFile(open.filter.id, { from: open.from, to: open.to }),
    );
    if (blob) saveFile(blob, `${open.filter.name}.xlsx`);
  }

  private open(filter: SavedFilter, period?: { from: string; to: string }): void {
    const params = { ...filter.params, ...period };
    this.selectedId.set(filter.id);
    this.context.setPeriod(params['from'], params['to']);
    this.applied.emit(params);
  }

  private currentParams(): FilterParams {
    return { ...this.params(), from: this.context.from(), to: this.context.to() };
  }

  private async run<T>(call: Observable<T>, done?: string): Promise<T | null> {
    try {
      const result = await firstValueFrom(call);
      if (done) this.message.success(done);
      return result;
    } catch (err) {
      this.message.error(errorMessage(err));
      return null;
    }
  }
}
