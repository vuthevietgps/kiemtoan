import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { errorMessage } from '../../core/api/api';
import { NotificationPreferences, NotificationsApi } from './data-access/notifications.api';

const TEXT = {
  title: 'Nhắc việc',
  email: 'Nhận email nhắc việc (gần hạn, đến hạn, quá hạn, soát xét quá hạn)',
  digest: 'Nhận bản tin công việc buổi sáng (ngày làm việc)',
  hint: 'Thông báo trong ứng dụng luôn được gửi; Zalo chưa hỗ trợ.',
  saved: 'Đã lưu tuỳ chọn nhắc việc',
} as const;

/** Tuỳ chọn nhận email nhắc việc và bản tin sáng của chính mình (06, I10). */
@Component({
  selector: 'app-notification-preferences',
  imports: [FormsModule, NzSwitchModule],
  template: `
    <section class="panel">
      <h3>{{ text.title }}</h3>
      @if (prefs(); as p) {
        <label class="row">
          <nz-switch [ngModel]="p.emailEnabled" [nzLoading]="busy()" (ngModelChange)="save({ emailEnabled: $event })" />
          <span>{{ text.email }}</span>
        </label>
        <label class="row">
          <nz-switch [ngModel]="p.digestEnabled" [nzLoading]="busy()" (ngModelChange)="save({ digestEnabled: $event })" />
          <span>{{ text.digest }}</span>
        </label>
      }
      <p class="text-muted">{{ text.hint }}</p>
    </section>
  `,
  styles: `
    .row { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
    .row span { flex: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPreferencesComponent {
  private readonly api = inject(NotificationsApi);
  private readonly message = inject(NzMessageService);
  protected readonly text = TEXT;
  protected readonly prefs = signal<NotificationPreferences | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    this.api.preferences().subscribe({ next: (p) => this.prefs.set(p), error: () => undefined });
  }

  protected save(patch: Partial<NotificationPreferences>): void {
    const current = this.prefs();
    if (!current || this.busy()) return;
    this.busy.set(true);
    this.api.setPreferences({ ...current, ...patch }).subscribe({
      next: (p) => {
        this.prefs.set(p);
        this.busy.set(false);
        this.message.success(TEXT.saved);
      },
      error: (err: unknown) => {
        this.prefs.set({ ...current });
        this.busy.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }
}
