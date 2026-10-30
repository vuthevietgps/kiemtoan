import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CREDENTIAL_STATUS_COLORS,
  CREDENTIAL_STATUS_LABELS,
  CREDENTIAL_TYPE_LABELS,
} from '../../customers/customer-labels';
import {
  CREDENTIALS_TEXT,
  CredentialDialog,
  CUSTODY_COLORS,
  CUSTODY_LABELS,
  DIALOG_TITLES,
  TOKEN_PROVIDER_LABELS,
} from '../client-credentials.text';
import type { CredentialDetail, CredentialEvent } from '../data-access/client-credentials.api';
import { CredentialTimelineComponent } from './credential-timeline.component';

/**
 * Ngăn chi tiết tài khoản / token (09-D): thông tin, Xem (tự ẩn) / Sao chép (L6), thao tác theo nơi giữ
 * và quyền (L4, L7, L10), lịch sử và nhật ký xem / sao chép (L8). Chỉ phát sự kiện, không gọi API.
 */
@Component({
  selector: 'app-credential-drawer',
  imports: [
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzIconModule,
    NzTabsModule,
    NzTagModule,
    CredentialTimelineComponent,
  ],
  templateUrl: './credential-drawer.component.html',
  styleUrl: './credential-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialDrawerComponent {
  readonly detail = input<CredentialDetail | null>(null);
  readonly accessLog = input<CredentialEvent[] | null>(null);
  readonly busy = input(false);
  readonly error = input('');
  /** Mật khẩu đang hiện và số giây còn lại trước khi tự ẩn. */
  readonly revealed = input<string | null>(null);
  readonly revealLeft = input(0);
  readonly canUpdate = input(false);
  readonly canDelete = input(false);
  readonly canViewSecret = input(false);
  readonly currentUserId = input<string | null>(null);
  readonly closed = output<void>();
  readonly edit = output<void>();
  readonly dialog = output<CredentialDialog>();
  readonly view = output<void>();
  readonly copySecret = output<void>();
  readonly hide = output<void>();
  readonly loadLog = output<void>();

  protected readonly text = CREDENTIALS_TEXT;
  protected readonly typeLabels = CREDENTIAL_TYPE_LABELS;
  protected readonly statusLabels = CREDENTIAL_STATUS_LABELS;
  protected readonly statusColors = CREDENTIAL_STATUS_COLORS;
  protected readonly providers = TOKEN_PROVIDER_LABELS;
  protected readonly custodyLabels = CUSTODY_LABELS;
  protected readonly custodyColors = CUSTODY_COLORS;
  protected readonly titles = DIALOG_TITLES;

  protected readonly width = computed(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 560,
  );
  protected readonly token = computed(() => this.detail()?.type === 'DIGITAL_SIGNATURE');

  /** Thao tác được phép với tài khoản đang mở (máy chủ vẫn kiểm lại). */
  protected readonly actions = computed((): { dialog: CredentialDialog; label: string }[] => {
    const d = this.detail();
    if (!d) return [];
    const manage = this.canUpdate();
    const list: { dialog: CredentialDialog; label: string }[] = [];
    if (this.token()) {
      const custody = d.custody;
      if (custody === 'OFFICE') list.push({ dialog: 'borrow', label: this.titles.borrow });
      if (custody === 'LOANED' && (manage || d.holder?.id === this.currentUserId()))
        list.push({ dialog: 'return', label: this.titles.return });
      if (manage && (custody === 'OFFICE' || custody === 'LOANED'))
        list.push({ dialog: 'handOver', label: this.titles.handOver });
      if (manage && custody !== 'LOANED')
        list.push({ dialog: 'office', label: this.officeLabel(custody) });
      if (manage && custody !== 'CUSTOMER')
        list.push({ dialog: 'customer', label: this.titles.customer });
    }
    list.push({ dialog: 'report', label: this.titles.report });
    if (this.canDelete() && d.custody !== 'LOANED')
      list.push({ dialog: 'delete', label: this.titles.delete });
    return list;
  });

  private officeLabel(custody: CredentialDetail['custody']): string {
    if (custody === 'CUSTOMER') return 'Nhận từ khách';
    if (custody === 'OFFICE') return 'Đổi nơi cất';
    return this.titles.office;
  }

  protected tabChanged(index: number): void {
    if (index === 1 && !this.accessLog()) this.loadLog.emit();
  }
}
