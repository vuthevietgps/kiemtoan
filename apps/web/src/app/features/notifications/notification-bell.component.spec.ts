import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ICONS } from '../../core/icons/app-icons';
import { AppNotification, NotificationsApi } from './data-access/notifications.api';
import { NotificationBellComponent } from './notification-bell.component';

const item = (patch: Partial<AppNotification>): AppNotification => ({
  id: 'n',
  title: 'Thông báo',
  link: null,
  readAt: null,
  createdAt: '2027-03-10T01:00:00Z',
  kind: 'GENERAL',
  severity: 'INFO',
  ...patch,
});

describe('NotificationBellComponent (06-D4)', () => {
  const api = { latest: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() };
  const router = { navigateByUrl: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.latest.mockReturnValue(
      of({
        items: [
          item({ id: 'a', title: 'Quá hạn: Tờ khai', kind: 'OVERDUE', severity: 'DANGER', link: '/deadlines?id=o1' }),
          item({ id: 'b', title: 'Bạn được giao việc', readAt: '2027-03-09T01:00:00Z' }),
        ],
        unreadCount: 1,
      }),
    );
    api.markRead.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideNzIcons(APP_ICONS),
        { provide: NotificationsApi, useValue: api },
        { provide: Router, useValue: router },
      ],
    });
  });

  async function openPanel() {
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.trigger')!.click();
    // nz-dropdown mở menu sau auditTime(150 ms).
    await new Promise((resolve) => setTimeout(resolve, 200));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  const panel = () => document.body.querySelector<HTMLElement>('.bell-panel')!;

  it('nhãn loại nhắc việc và tô đỏ mức Quá hạn; thông báo thường không có nhãn', async () => {
    await openPanel();
    const rows = [...panel().querySelectorAll<HTMLElement>('.item')];
    expect(rows[0].querySelector('.kind')?.textContent?.trim()).toBe('Quá hạn');
    expect(rows[0].classList).toContain('danger');
    expect(rows[0].classList).toContain('unread');
    expect(rows[1].querySelector('.kind')).toBeNull();
  });

  it('lọc Chưa đọc gọi API với unread; mở thông báo đánh dấu đã đọc và đi tới liên kết', async () => {
    const fixture = await openPanel();
    const unreadFilter = [...panel().querySelectorAll<HTMLButtonElement>('.filter')][1];
    expect(unreadFilter.textContent).toContain('Chưa đọc (1)');
    unreadFilter.click();
    fixture.detectChanges();
    expect(api.latest).toHaveBeenLastCalledWith(true);
    panel().querySelector<HTMLButtonElement>('.item')!.click();
    expect(api.markRead).toHaveBeenCalledWith('a');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/deadlines?id=o1');
  });
});
