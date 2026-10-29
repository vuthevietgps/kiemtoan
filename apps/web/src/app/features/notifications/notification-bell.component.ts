import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AppNotification, NotificationsApi } from './data-access/notifications.api';
import {
  NOTIFICATION_KIND_LABELS,
  NOTIFICATIONS_TEXT,
  SEVERITY_COLORS,
} from './notifications.text';

const REFRESH_MS = 60_000;

/**
 * Chuông thông báo trên thanh trên cùng: số chưa đọc, danh sách (tất cả / chưa đọc), nhãn loại và
 * mức độ nhắc việc (06-D4; đỏ = quá hạn, leo thang), tự tải lại mỗi 60 giây.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [
    DatePipe,
    NzBadgeModule,
    NzIconModule,
    NzDropDownModule,
    NzButtonModule,
    NzEmptyModule,
    NzTagModule,
  ],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBellComponent {
  private readonly api = inject(NotificationsApi);
  private readonly router = inject(Router);
  private request = 0;

  protected readonly text = NOTIFICATIONS_TEXT;
  protected readonly kindLabels = NOTIFICATION_KIND_LABELS;
  protected readonly severityColors = SEVERITY_COLORS;
  protected readonly items = signal<AppNotification[]>([]);
  protected readonly unread = signal(0);
  protected readonly unreadOnly = signal(false);

  constructor() {
    this.load();
    const timer = setInterval(() => this.load(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected load(): void {
    const request = ++this.request;
    this.api.latest(this.unreadOnly()).subscribe({
      next: (res) => {
        if (request !== this.request) return;
        this.items.set(res.items);
        this.unread.set(res.unreadCount);
      },
      // Lỗi mạng tạm thời: giữ nguyên dữ liệu cũ, lần sau tải lại.
      error: () => undefined,
    });
  }

  protected setFilter(unreadOnly: boolean, event: Event): void {
    // Giữ menu mở khi đổi bộ lọc.
    event.stopPropagation();
    if (this.unreadOnly() === unreadOnly) return;
    this.unreadOnly.set(unreadOnly);
    this.load();
  }

  protected open(n: AppNotification): void {
    if (!n.readAt) {
      this.items.update((list) =>
        list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
      this.unread.update((c) => Math.max(0, c - 1));
      this.api.markRead(n.id).subscribe({ error: () => this.load() });
    }
    if (n.link) void this.router.navigateByUrl(n.link);
  }

  protected markAll(): void {
    this.api.markAllRead().subscribe({ next: () => this.load() });
  }
}
