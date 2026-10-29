import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { NotificationsApi } from './data-access/notifications.api';
import { NotificationPreferencesComponent } from './notification-preferences.component';

describe('NotificationPreferencesComponent (06, I10)', () => {
  function setup(setPreferences = vi.fn((p: unknown) => of(p))) {
    const api = {
      preferences: vi.fn(() => of({ emailEnabled: true, digestEnabled: true })),
      setPreferences,
    };
    TestBed.configureTestingModule({
      providers: [provideNoopAnimations(), { provide: NotificationsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(NotificationPreferencesComponent);
    fixture.detectChanges();
    return { fixture, api, cmp: fixture.componentInstance };
  }

  it('tắt email gửi đủ hai tuỳ chọn và giữ bản tin', () => {
    const { api, cmp } = setup();
    cmp['save']({ emailEnabled: false });
    expect(api.setPreferences).toHaveBeenCalledWith({ emailEnabled: false, digestEnabled: true });
    expect(cmp['prefs']()).toEqual({ emailEnabled: false, digestEnabled: true });
  });

  it('lưu lỗi thì giữ giá trị cũ', () => {
    const { cmp } = setup(vi.fn(() => throwError(() => ({ error: { message: 'Lỗi mạng' } }))));
    cmp['save']({ digestEnabled: false });
    expect(cmp['prefs']()).toEqual({ emailEnabled: true, digestEnabled: true });
    expect(cmp['busy']()).toBe(false);
  });
});
