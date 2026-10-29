import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { thresholdsValid } from '../pages/reminder-settings.panel';
import { CalendarYearStore } from './calendar-year.store';
import { DeadlineSettingsApi } from './deadline-settings.api';
import { ObligationTypesStore } from './obligation-types.store';
import { ReminderConfigStore } from './reminder-config.store';

const conflict = { error: { message: 'Cấu hình vừa được người khác sửa; vui lòng tải lại' } };

describe('Store cấu hình 06 (06-D3)', () => {
  const api = {
    listTypes: vi.fn(),
    confirmDraft: vi.fn(),
    calendarYear: vi.fn(),
    saveYear: vi.fn(),
    confirmYear: vi.fn(),
    reminderSettings: vi.fn(),
    serviceThresholds: vi.fn(),
    saveReminderSettings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ObligationTypesStore,
        CalendarYearStore,
        ReminderConfigStore,
        { provide: DeadlineSettingsApi, useValue: api },
      ],
    });
  });

  it('loại nghĩa vụ: xác nhận thay đúng loại trong danh sách; lỗi giữ thông báo', async () => {
    const store = TestBed.inject(ObligationTypesStore);
    api.listTypes.mockReturnValue(of([{ id: 'a', versions: [] }, { id: 'b', versions: [] }]));
    await store.load();
    api.confirmDraft.mockReturnValue(of({ id: 'b', code: 'NEW', versions: [], synced: {} }));
    await store.confirm('b', 2);
    expect(api.confirmDraft).toHaveBeenCalledWith('b', 2);
    expect(store.types().map((t) => t.code)).toEqual([undefined, 'NEW']);
    api.confirmDraft.mockReturnValue(throwError(() => conflict));
    expect(await store.confirm('b', 2)).toBeNull();
    expect(store.error()).toContain('người khác sửa');
    expect(store.busy()).toBe(false);
  });

  it('lịch năm: thêm ngày sắp theo ngày và đánh dấu chưa lưu; lưu gửi revision + lý do; xác nhận dùng revision mới', async () => {
    const store = TestBed.inject(CalendarYearStore);
    api.calendarYear.mockReturnValue(
      of({ year: 2027, status: 'CONFIRMED', revision: 3, confirmedAt: null, days: [] }),
    );
    await store.load(2027);
    store.addDay({ date: '2027-09-02', kind: 'DAY_OFF', name: 'Quốc khánh' });
    store.addDay({ date: '2027-01-01', kind: 'DAY_OFF', name: 'Tết Dương lịch' });
    expect(store.days().map((d) => d.date)).toEqual(['2027-01-01', '2027-09-02']);
    expect(store.dirty()).toBe(true);
    api.saveYear.mockReturnValue(
      of({ year: 2027, status: 'CONFIRMED', revision: 4, days: store.days(), changedDues: 2 }),
    );
    expect(await store.save('Bổ sung lịch nghỉ')).toBe(2);
    expect(api.saveYear).toHaveBeenCalledWith(2027, store.days(), 3, 'Bổ sung lịch nghỉ');
    expect(store.dirty()).toBe(false);
    api.confirmYear.mockReturnValue(of({ year: 2027, status: 'CONFIRMED', revision: 5, days: [] }));
    await store.confirm();
    expect(api.confirmYear).toHaveBeenCalledWith(2027, 4);
  });

  it('nhắc việc: 409 khi lưu → giữ lỗi và nạp lại cấu hình mới nhất', async () => {
    const store = TestBed.inject(ReminderConfigStore);
    api.reminderSettings.mockReturnValue(
      of({ thresholds: [7, 3, 1], sendTime: '07:30', escalationWorkingDays: 3, revision: 2 }),
    );
    api.serviceThresholds.mockReturnValue(of([]));
    await store.loadSettings();
    api.saveReminderSettings.mockReturnValue(throwError(() => conflict));
    api.reminderSettings.mockReturnValue(
      of({ thresholds: [10, 5, 2], sendTime: '08:00', escalationWorkingDays: 3, revision: 3 }),
    );
    const ok = await store.saveSettings({ thresholds: [7, 3, 2], sendTime: '07:30', escalationWorkingDays: 3 });
    expect(ok).toBe(false);
    expect(api.saveReminderSettings).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }));
    await vi.waitFor(() => expect(store.settings()?.revision).toBe(3));
    expect(store.error()).toContain('người khác sửa');
  });

  it('ngưỡng mức gấp hợp lệ: 3 số nguyên 1–90 giảm dần', () => {
    expect(thresholdsValid([7, 3, 1])).toBe(true);
    expect(thresholdsValid([3, 3, 1])).toBe(false);
    expect(thresholdsValid([7, 3, null])).toBe(false);
    expect(thresholdsValid([91, 3, 1])).toBe(false);
    expect(thresholdsValid([7, 1.5, 1])).toBe(false);
  });
});
