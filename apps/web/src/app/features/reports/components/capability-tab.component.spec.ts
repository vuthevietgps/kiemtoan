import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_ICONS } from '../../../core/icons/app-icons';
import { UsersApi } from '../../users/data-access/users.api';
import { AssistantRow, CapabilityApi, CapabilityReport } from '../data-access/capability.api';
import { CapabilityTabComponent } from './capability-tab.component';

registerLocaleData(localeVi);

const row = (
  id: string,
  fullName: string,
  rate: number | null,
  statutoryLate = 0,
): AssistantRow => ({
  user: { id, fullName, teamId: null },
  total: 4,
  onTime: 3,
  late: 1,
  overdue: 0,
  rate,
  rateOriginal: 50,
  statutoryLate,
  clientDelay: 0,
  extensions: 1,
  submitted: 4,
  returned: 1,
  returnRate: 25,
  accepted: 3,
  openCustomers: 2,
});
const report: CapabilityReport = {
  from: '2026-05-01',
  to: '2026-05-31',
  role: 'ASSISTANT',
  domain: 'ALL',
  rows: [row('u1', 'An', 96), row('u2', 'Bình', 75, 1)],
};

describe('CapabilityTabComponent (10-E, M9)', () => {
  let api: { report: ReturnType<typeof vi.fn>; items: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      report: vi.fn(() => of(report)),
      items: vi.fn(() => of({ user: report.rows[0].user, role: 'ASSISTANT', tasks: [] })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideNzI18n(vi_VN),
        provideNzIcons(APP_ICONS),
        { provide: CapabilityApi, useValue: { ...api, exportFile: vi.fn() } },
        { provide: UsersApi, useValue: { teams: vi.fn(() => of([])) } },
        {
          provide: AuthService,
          useValue: { can: () => false, user: () => null, permissions: () => new Set() },
        },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(CapabilityTabComponent);
    fixture.componentRef.setInput('from', '2026-05-01');
    fixture.componentRef.setInput('to', '2026-05-31');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('mỗi chỉ số một cột, tô màu theo G8; trễ hạn pháp lý > 0 đỏ', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    const tones = [...el.querySelectorAll('.tone')].map((t) => [
      t.textContent?.trim(),
      t.getAttribute('data-tone'),
    ]);
    expect(tones).toContainEqual(['96%', 'good']);
    expect(tones).toContainEqual(['75%', 'bad']);
    expect(tones).toContainEqual(['1', 'bad']);
    expect(tones).toContainEqual(['25%', 'warn']);
    expect(el.textContent).not.toContain('Doanh thu');
  });

  it('bấm ô "Trễ" mở danh sách của người đó, lọc theo ô; đổi vai gọi lại API', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const anRow = [...el.querySelectorAll('tbody tr')].find((tr) => tr.querySelector('td.cell'))!;
    expect(anRow.textContent).toContain('An');
    anRow.querySelectorAll<HTMLElement>('td.cell')[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.items).toHaveBeenCalledWith('u1', expect.objectContaining({ role: 'ASSISTANT' }));
    expect(fixture.componentInstance['cell']()).toBe('LATE');
    fixture.componentInstance['role'].set('LEAD');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.report).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'LEAD' }));
  });
});
