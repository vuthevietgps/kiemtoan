import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { BehaviorSubject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_ICONS } from '../../../core/icons/app-icons';
import { CapabilityApi } from '../data-access/capability.api';
import { OperationsReportsApi } from '../data-access/operations-reports.api';
import { ReportContext } from '../data-access/report-context';
import { SavedFilter, SavedFiltersApi } from '../data-access/saved-filters.api';
import { ReportsPage } from '../pages/reports.page';
import { SavedFiltersComponent } from './saved-filters.component';

registerLocaleData(localeVi);

const filter = (patch: Partial<SavedFilter> = {}): SavedFilter => ({
  id: 'f1',
  report: 'capability',
  name: 'Trưởng nhóm kế toán',
  params: { from: '2026-01-01', to: '2026-06-30', role: 'LEAD', domain: 'ACCOUNTING' },
  schedule: null,
  ...patch,
});

function apiMock(rows: SavedFilter[]) {
  return {
    list: vi.fn(() => of(rows)),
    get: vi.fn(() => of(rows[0])),
    create: vi.fn(() => of(filter({ id: 'f2', name: 'Mới' }))),
    updateParams: vi.fn(() => of(rows[0])),
    remove: vi.fn(() => of({})),
    saveSchedule: vi.fn(() => of(rows[0])),
    removeSchedule: vi.fn(() => of(rows[0])),
    exportFile: vi.fn(() => of(new Blob(['x']))),
  };
}

const authMock = (permissions: string[]) => ({
  can: (p: string) => permissions.includes(p),
  user: () => null,
  permissions: () => new Set(permissions),
});

describe('SavedFiltersComponent (10-F, M11–M12)', () => {
  let api: ReturnType<typeof apiMock>;

  async function render(rows: SavedFilter[], permissions = ['reports:export']) {
    api = apiMock(rows);
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideNzI18n(vi_VN),
        provideNzIcons(APP_ICONS),
        ReportContext,
        { provide: SavedFiltersApi, useValue: api },
        { provide: AuthService, useValue: authMock(permissions) },
      ],
    });
    const fixture = TestBed.createComponent(SavedFiltersComponent);
    fixture.componentRef.setInput('report', 'capability');
    fixture.componentRef.setInput('params', { role: 'MANAGER', domain: 'ALL', teamId: null });
    const applied: Record<string, string>[] = [];
    fixture.componentInstance.applied.subscribe((p) => applied.push(p));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, applied, context: TestBed.inject(ReportContext) };
  }

  it('chọn bộ lọc: mở lại đúng kỳ và lựa chọn đã lưu', async () => {
    const { fixture, applied, context } = await render([filter()]);
    fixture.componentInstance['pick']('f1');
    expect(applied).toEqual([filter().params]);
    expect([context.from(), context.to()]).toEqual(['2026-01-01', '2026-06-30']);
    expect(api.list).toHaveBeenCalledWith('capability');
  });

  it('lưu mới gửi lựa chọn đang xem kèm kỳ đang chọn; tên rỗng không gửi', async () => {
    const { fixture, context } = await render([]);
    context.setPeriod('2026-03-01', '2026-03-31');
    const c = fixture.componentInstance;
    c['name'].set('   ');
    await c['saveNew']();
    expect(api.create).not.toHaveBeenCalled();
    c['name'].set('Tháng 3');
    await c['saveNew']();
    expect(api.create).toHaveBeenCalledWith('capability', 'Tháng 3', {
      role: 'MANAGER',
      domain: 'ALL',
      teamId: null,
      from: '2026-03-01',
      to: '2026-03-31',
    });
    expect(c['selectedId']()).toBe('f2');
  });

  it('hẹn gửi: chọn tần suất lưu lịch, bỏ chọn xoá lịch; có ghi chú kỳ số liệu', async () => {
    const weekly = filter({
      schedule: {
        frequency: 'WEEKLY',
        enabled: true,
        lastSentAt: null,
        lastResult: 'NOT_EMAILED',
        stoppedReason: null,
      },
    });
    const { fixture } = await render([weekly]);
    const c = fixture.componentInstance;
    c['pick']('f1');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('số liệu tuần trước');
    expect(text).toContain('chưa gửi email');
    await c['changeSchedule']('MONTHLY');
    expect(api.saveSchedule).toHaveBeenCalledWith('f1', 'MONTHLY');
    await c['changeSchedule'](null);
    expect(api.removeSchedule).toHaveBeenCalledWith('f1');
  });

  it('không có quyền xuất thì không có ô hẹn gửi; lịch tự dừng hiện lý do', async () => {
    const stopped = filter({
      schedule: {
        frequency: 'WEEKLY',
        enabled: false,
        lastSentAt: null,
        lastResult: 'STOPPED',
        stoppedReason: 'Bạn không còn quyền xuất báo cáo này',
      },
    });
    const { fixture } = await render([stopped], []);
    fixture.componentInstance['pick']('f1');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.freq')).toBeNull();
    expect(el.textContent).toContain('Lịch gửi đã dừng: Bạn không còn quyền');
  });

  it('mở từ thông báo: dùng kỳ của lượt gửi, tải Excel đúng kỳ', async () => {
    const { fixture, applied, context } = await render([filter()]);
    context.scheduled.set({ filter: filter(), from: '2026-11-02', to: '2026-11-08' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(applied.at(-1)).toMatchObject({ role: 'LEAD', from: '2026-11-02', to: '2026-11-08' });
    expect(context.from()).toBe('2026-11-02');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('02/11/2026 – 08/11/2026');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await fixture.componentInstance['downloadScheduled']();
    expect(api.exportFile).toHaveBeenCalledWith('f1', { from: '2026-11-02', to: '2026-11-08' });
  });
});

describe('ReportsPage — link thông báo định kỳ (10-F)', () => {
  it('mở đúng tab của bộ lọc theo các tab người đó thấy', async () => {
    const api = apiMock([filter()]);
    const query = new BehaviorSubject(
      convertToParamMap({ savedFilter: 'f1', from: '2026-11-02', to: '2026-11-08' }),
    );
    const compliance = {
      summary: { onTime: 0, late: 0, overdue: 0, notDue: 0, clientDelay: 0, onTimeRate: null },
      byMonth: [],
      byCustomer: [],
      items: [],
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideNzI18n(vi_VN),
        provideNzIcons(APP_ICONS),
        { provide: ActivatedRoute, useValue: { queryParamMap: query } },
        { provide: SavedFiltersApi, useValue: api },
        {
          provide: OperationsReportsApi,
          useValue: { deadlineCompliance: () => of(compliance) },
        },
        {
          provide: CapabilityApi,
          useValue: {
            report: vi.fn(() =>
              of({ from: '', to: '', role: 'LEAD', domain: 'ACCOUNTING', rows: [] }),
            ),
          },
        },
        { provide: AuthService, useValue: authMock(['reports:view_operations']) },
      ],
    });
    const fixture = TestBed.createComponent(ReportsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Nhân viên: Tuân thủ deadline, Hợp đồng, Khách hàng, Đánh giá năng lực → chỉ số 3.
    expect(fixture.componentInstance['tabIndex']()).toBe(3);
    expect(api.get).toHaveBeenCalledWith('f1');
  });
});
