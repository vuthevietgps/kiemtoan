import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { toDateKey } from '../../../shared/utils/date-key';
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '../../tasks/task-labels';
import type { ObligationDetail } from '../data-access/obligations.api';
import type { ObligationAction } from '../data-access/obligations.store';
import {
  DEADLINES_TEXT,
  OBLIGATION_STATUS_COLORS,
  OBLIGATION_STATUS_LABELS,
} from '../deadlines.text';

type Mode = 'none' | 'file' | 'notApplicable' | 'reopen';

/**
 * Ngăn chi tiết một nghĩa vụ (I7): thông tin, việc gắn, biên nhận, lịch sử và thao tác theo trạng
 * thái/quyền. Chỉ phát sự kiện, không gọi API.
 */
@Component({
  selector: 'app-obligation-drawer',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputModule,
    NzTagModule,
    NzTimelineModule,
  ],
  templateUrl: './obligation-drawer.component.html',
  styleUrl: './obligation-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObligationDrawerComponent {
  readonly detail = input<ObligationDetail | null>(null);
  readonly busy = input(false);
  readonly error = input('');
  readonly canUpdate = input(false);
  readonly canApprove = input(false);
  readonly closed = output<void>();
  readonly action = output<ObligationAction>();
  readonly openTask = output<string>();
  readonly openCustomer = output<string>();
  readonly downloadReceipt = output<{ id: string; fileName: string }>();

  protected readonly text = DEADLINES_TEXT;
  protected readonly labels = OBLIGATION_STATUS_LABELS;
  protected readonly colors = OBLIGATION_STATUS_COLORS;
  protected readonly taskLabels = TASK_STATUS_LABELS;
  protected readonly taskColors = TASK_STATUS_COLORS;
  protected readonly mode = signal<Mode>('none');
  protected readonly filedAt = signal<Date | null>(new Date());
  protected readonly file = signal<File | null>(null);
  protected readonly note = signal('');
  protected readonly reason = signal('');
  protected readonly width = computed(() =>
    typeof window !== 'undefined' && window.innerWidth < 520 ? '100%' : 480,
  );

  /** Thao tác được phép theo trạng thái lưu (không theo "Trễ hạn" hiển thị). */
  protected readonly isOpen = computed(() => {
    const s = this.detail()?.status;
    return s === 'NOT_DUE' || s === 'PREPARING';
  });
  protected readonly canReopen = computed(() => {
    const s = this.detail()?.status;
    return this.canApprove() && (s === 'FILED' || s === 'NOT_APPLICABLE');
  });
  protected readonly reasonValid = computed(() => {
    const n = this.reason().trim().length;
    return n >= 5 && n <= 500;
  });

  constructor() {
    // Đổi sang nghĩa vụ khác hoặc thao tác xong (revision đổi) thì đóng biểu mẫu đang mở.
    effect(() => {
      this.detail();
      this.reset();
    });
  }

  protected readonly disabledDate = (d: Date): boolean => d > new Date();

  protected start(mode: Mode): void {
    this.reset();
    this.mode.set(mode);
  }

  protected reset(): void {
    this.mode.set('none');
    this.filedAt.set(new Date());
    this.file.set(null);
    this.note.set('');
    this.reason.set('');
  }

  protected pickFile(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected submit(): void {
    const mode = this.mode();
    const note = this.note().trim() || undefined;
    if (mode === 'file') {
      const file = this.file();
      const filedAt = this.filedAt();
      if (!file || !filedAt) return;
      this.action.emit({ kind: 'file', filedAt: toDateKey(filedAt), file, note });
    } else if (mode === 'notApplicable' || mode === 'reopen') {
      if (!this.reasonValid()) return;
      this.action.emit({ kind: mode, reason: this.reason().trim() });
    }
  }

  protected prepare(): void {
    this.action.emit({ kind: 'prepare' });
  }
}
