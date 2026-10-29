import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { TasksApi } from '../../tasks/data-access/tasks.api';
import { CalendarApi, CalendarEventsResult } from './calendar.api';
import { CalendarStore, EMPTY_FILTERS } from './calendar.store';

const result = (title: string): CalendarEventsResult =>
  ({
    events: [{ kind: 'TASK', id: title, title }],
    truncated: false,
    days: [],
    unconfirmedYears: [2027],
  }) as unknown as CalendarEventsResult;

describe('CalendarStore (06-D)', () => {
  const api = { events: vi.fn(), obligationTypes: vi.fn() };
  const tasksApi = { customerOptions: vi.fn(), userOptions: vi.fn() };
  const permissions = signal(new Set<string>(['tasks:view']));
  let store: CalendarStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.events.mockReturnValue(of(result('a')));
    api.obligationTypes.mockReturnValue(of([{ id: 't', code: 'T', name: 'Loại' }]));
    tasksApi.customerOptions.mockReturnValue(of([{ id: 'c', name: 'KH', taxCode: '1' }]));
    tasksApi.userOptions.mockReturnValue(of([{ id: 'u', fullName: 'NV', role: 'STAFF' }]));
    TestBed.configureTestingModule({
      providers: [
        CalendarStore,
        { provide: CalendarApi, useValue: api },
        { provide: TasksApi, useValue: tasksApi },
        { provide: AuthService, useValue: { permissions } },
      ],
    });
    store = TestBed.inject(CalendarStore);
  });

  it('tải theo khoảng FullCalendar báo; cùng khoảng không tải lại', async () => {
    store.setRange('2027-03-01', '2027-04-11');
    store.setRange('2027-03-01', '2027-04-11');
    await vi.waitFor(() => expect(store.result().events).toHaveLength(1));
    expect(api.events).toHaveBeenCalledTimes(1);
    expect(api.events).toHaveBeenCalledWith('2027-03-01', '2027-04-11', EMPTY_FILTERS);
    expect(store.result().unconfirmedYears).toEqual([2027]);
  });

  it('đổi bộ lọc tải lại với bộ lọc mới; kết quả cũ về muộn bị bỏ', async () => {
    const slow = new Subject<CalendarEventsResult>();
    api.events.mockReturnValueOnce(slow).mockReturnValueOnce(of(result('mới')));
    store.setRange('2027-03-01', '2027-03-31');
    const filters = { ...EMPTY_FILTERS, kind: 'STATUTORY' as const };
    store.setFilters(filters);
    await vi.waitFor(() => expect(store.result().events[0]?.id).toBe('mới'));
    slow.next(result('cũ'));
    slow.complete();
    await Promise.resolve();
    expect(store.result().events[0].id).toBe('mới');
    expect(api.events).toHaveBeenLastCalledWith('2027-03-01', '2027-03-31', filters);
    expect(store.loading()).toBe(false);
  });

  it('chưa có khoảng ngày thì đổi lọc không gọi API', () => {
    store.setFilters({ ...EMPTY_FILTERS, status: 'OPEN' });
    expect(api.events).not.toHaveBeenCalled();
  });

  it('danh sách chọn theo quyền: không có tasks:approve/deadlines:view thì không tải nhân viên/loại', async () => {
    await store.loadOptions();
    expect(store.customers()).toHaveLength(1);
    expect(tasksApi.userOptions).not.toHaveBeenCalled();
    expect(api.obligationTypes).not.toHaveBeenCalled();
    permissions.set(new Set(['tasks:view', 'tasks:approve', 'deadlines:view']));
    await store.loadOptions();
    expect(store.users()).toHaveLength(1);
    expect(store.types()).toHaveLength(1);
  });
});
