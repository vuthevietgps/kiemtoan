import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import type { ObligationSetting } from '../data-access/obligations.api';
import { DEADLINES_TEXT } from '../deadlines.text';

export interface SettingChange {
  typeId: string;
  enabled: boolean;
  reason: string;
}

/** Loại báo cáo áp dụng cho một KH (I4): bật/tắt riêng, bắt buộc lý do. Chỉ phát sự kiện. */
@Component({
  selector: 'app-obligation-settings',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzTagModule],
  templateUrl: './obligation-settings.component.html',
  styleUrl: './obligation-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObligationSettingsComponent {
  readonly settings = input.required<ObligationSetting[]>();
  readonly canUpdate = input(false);
  readonly busy = input(false);
  readonly changeSetting = output<SettingChange>();

  protected readonly text = DEADLINES_TEXT;
  /** Loại đang mở ô nhập lý do. */
  protected readonly editing = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly reasonValid = computed(() => {
    const n = this.reason().trim().length;
    return n >= 5 && n <= 500;
  });

  protected enabled(s: ObligationSetting): boolean {
    return s.setting ? s.setting.enabled : true;
  }

  protected edit(typeId: string): void {
    this.editing.set(typeId);
    this.reason.set('');
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  protected confirm(s: ObligationSetting): void {
    if (!this.reasonValid()) return;
    this.changeSetting.emit({
      typeId: s.id,
      enabled: !this.enabled(s),
      reason: this.reason().trim(),
    });
    this.editing.set(null);
  }
}
