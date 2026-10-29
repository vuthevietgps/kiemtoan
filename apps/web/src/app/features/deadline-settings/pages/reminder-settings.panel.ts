import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { AuthService } from '../../../core/auth/auth.service';
import { ServiceCatalogApi } from '../../service-catalog/data-access/service-catalog.api';
import { ReminderConfigStore } from '../data-access/reminder-config.store';
import { SETTINGS_TEXT } from '../deadline-settings.text';

/** 3 ngưỡng số nguyên 1–90 giảm dần (như kiểm tra ở API — I11). */
export function thresholdsValid(t: (number | null)[]): t is number[] {
  return (
    t.length === 3 &&
    t.every((n) => n != null && Number.isInteger(n) && n >= 1 && n <= 90) &&
    t[0]! > t[1]! &&
    t[1]! > t[2]!
  );
}

/** Tab "Nhắc việc" (I9, I11): ngưỡng mức gấp/mốc nhắc, giờ gửi, leo thang, ngưỡng riêng theo dịch vụ. */
@Component({
  selector: 'app-reminder-settings-panel',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTimePickerModule,
  ],
  providers: [ReminderConfigStore],
  templateUrl: './reminder-settings.panel.html',
  styleUrl: './reminder-settings.panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReminderSettingsPanel implements OnInit {
  protected readonly store = inject(ReminderConfigStore);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly catalog = inject(ServiceCatalogApi);

  protected readonly text = SETTINGS_TEXT;
  protected readonly canUpdate = computed(() => this.auth.can('settings:update'));
  protected readonly thresholds = signal<(number | null)[]>([7, 3, 1]);
  protected readonly sendTime = signal('07:30');
  /** Ô chọn giờ dùng Date; lưu dạng 'HH:mm' giờ VN. */
  protected readonly sendTimeDate = computed(() => {
    const [h, m] = this.sendTime().split(':').map(Number);
    return new Date(2000, 0, 1, h, m);
  });
  protected readonly escalation = signal<number | null>(3);
  protected readonly services = signal<{ id: string; label: string }[]>([]);
  protected readonly serviceId = signal<string | null>(null);
  protected readonly serviceThresholds = signal<(number | null)[]>([15, 7, 3]);
  protected readonly valid = computed(
    () =>
      thresholdsValid(this.thresholds()) &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(this.sendTime()) &&
      Number.isInteger(this.escalation()) &&
      this.escalation()! >= 1 &&
      this.escalation()! <= 30,
  );
  protected readonly serviceValid = computed(
    () => !!this.serviceId() && thresholdsValid(this.serviceThresholds()),
  );

  constructor() {
    // Nạp form theo cấu hình mới nhất (lần đầu và sau khi lưu/409).
    effect(() => {
      const s = this.store.settings();
      if (!s) return;
      this.thresholds.set([...s.thresholds]);
      this.sendTime.set(s.sendTime);
      this.escalation.set(s.escalationWorkingDays);
    });
  }

  ngOnInit(): void {
    void this.store.loadSettings();
    void firstValueFrom(this.catalog.list()).then(
      (list) => this.services.set(list.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }))),
      () => undefined,
    );
  }

  protected pickTime(value: Date | null): void {
    if (!value) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    this.sendTime.set(`${pad(value.getHours())}:${pad(value.getMinutes())}`);
  }

  protected setThreshold(target: 'global' | 'service', index: number, value: number | null): void {
    const sig = target === 'global' ? this.thresholds : this.serviceThresholds;
    sig.update((list) => list.map((v, i) => (i === index ? value : v)));
  }

  protected async save(): Promise<void> {
    const thresholds = this.thresholds();
    if (!thresholdsValid(thresholds)) return;
    const ok = await this.store.saveSettings({
      thresholds,
      sendTime: this.sendTime(),
      escalationWorkingDays: this.escalation()!,
    });
    if (ok) this.message.success(this.text.saved);
  }

  protected async saveService(): Promise<void> {
    const t = this.serviceThresholds();
    const id = this.serviceId();
    if (!id || !thresholdsValid(t)) return;
    if (await this.store.setThresholds(id, t)) {
      this.serviceId.set(null);
      this.message.success(this.text.saved);
    }
  }

  protected edit(serviceTypeId: string, thresholds: number[]): void {
    this.serviceId.set(serviceTypeId);
    this.serviceThresholds.set([...thresholds]);
  }

  protected async runNow(): Promise<void> {
    const result = await this.store.runNow();
    if (result) this.message.success(this.text.ran(result.inApp, result.emailsQueued));
  }
}
