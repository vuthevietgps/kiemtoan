import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../core/auth/auth.service';
import type { Delivery } from '../data-access/deadline-settings.api';
import { ReminderConfigStore } from '../data-access/reminder-config.store';
import {
  CHANNEL_LABELS,
  DELIVERY_STATUS_COLORS,
  DELIVERY_STATUS_LABELS,
  SETTINGS_TEXT,
} from '../deadline-settings.text';

/** Tab "Nhật ký gửi" (I12): lọc trạng thái/kênh, xem lỗi, gửi lại email Thất bại/Không gửi. */
@Component({
  selector: 'app-deliveries-panel',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [ReminderConfigStore],
  templateUrl: './deliveries.panel.html',
  styleUrl: './deliveries.panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveriesPanel implements OnInit {
  protected readonly store = inject(ReminderConfigStore);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  protected readonly text = SETTINGS_TEXT;
  protected readonly statusLabels = DELIVERY_STATUS_LABELS;
  protected readonly statusColors = DELIVERY_STATUS_COLORS;
  protected readonly channelLabels = CHANNEL_LABELS;
  protected readonly statuses = Object.keys(DELIVERY_STATUS_LABELS);
  protected readonly channels = Object.keys(CHANNEL_LABELS);
  protected readonly search = signal('');
  protected readonly canRetry = computed(() => this.auth.can('settings:update'));
  /** I12/QD09: có email "Không gửi" trong trang → cảnh báo SMTP/địa chỉ nhận. */
  protected readonly hasSkipped = computed(() =>
    this.store.deliveries().some((d) => d.status === 'SKIPPED'),
  );

  ngOnInit(): void {
    void this.store.loadDeliveries();
  }

  protected retryable(d: Delivery): boolean {
    return d.channel === 'EMAIL' && (d.status === 'FAILED' || d.status === 'SKIPPED');
  }

  protected applySearch(): void {
    const search = this.search().trim();
    if (search !== this.store.query().search) this.store.setQuery({ search });
  }

  protected async retry(id: string): Promise<void> {
    if (await this.store.retry(id)) this.message.success(this.text.retried);
  }
}
