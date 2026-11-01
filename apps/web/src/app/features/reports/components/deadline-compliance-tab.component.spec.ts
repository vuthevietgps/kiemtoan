import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_ICONS } from '../../../core/icons/app-icons';
import {
  DeadlineComplianceReport,
  OperationsReportsApi,
} from '../data-access/operations-reports.api';
import { DeadlineComplianceTabComponent } from './deadline-compliance-tab.component';

registerLocaleData(localeVi);

const counts = { onTime: 1, late: 1, overdue: 1, notDue: 0, clientDelay: 1, onTimeRate: 33.3 };
const item = (id: string, outcome: 'ON_TIME' | 'LATE' | 'OVERDUE', clientDelay = false) => ({
  kind: 'OBLIGATION' as const,
  id,
  title: `Tờ khai ${id}`,
  customerId: 'c1',
  customerName: 'Công ty A',
  dueDate: '2026-09-20',
  doneOn: outcome === 'OVERDUE' ? null : '2026-09-22',
  outcome,
  daysLate: outcome === 'ON_TIME' ? 0 : 2,
  clientDelay,
});
const report: DeadlineComplianceReport = {
  from: '2026-01-01',
  to: '2026-12-31',
  summary: counts,
  byMonth: [{ month: '2026-09', ...counts }],
  byCustomer: [{ customerId: 'c1', name: 'Công ty A', ...counts }],
  items: [item('K1', 'ON_TIME'), item('K2', 'LATE', true), item('K3', 'OVERDUE')],
};

describe('DeadlineComplianceTabComponent (10-C, M6)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzI18n(vi_VN),
        provideNzIcons(APP_ICONS),
        {
          provide: OperationsReportsApi,
          useValue: { deadlineCompliance: vi.fn(() => of(report)), exportFile: vi.fn() },
        },
        {
          provide: AuthService,
          useValue: {
            can: () => true,
            user: () => null,
            permissions: () => new Set(['reports:export']),
          },
        },
      ],
    });
  });

  it('ô tổng hợp lọc danh sách chi tiết; số trên ô = số dòng; bấm lại bỏ lọc; tỷ lệ hiện %', async () => {
    const fixture = TestBed.createComponent(DeadlineComplianceTabComponent);
    fixture.componentRef.setInput('from', '2026-01-01');
    fixture.componentRef.setInput('to', '2026-12-31');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const heading = () => [...el.querySelectorAll('h4')].at(-1)?.textContent?.trim();
    expect(heading()).toBe('Danh sách chi tiết (3)');
    expect(el.textContent).toContain('33.3%');
    const tile = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('button.tile')].find((b) =>
        b.textContent?.includes(label),
      )!;
    tile('Trễ / quá hạn do khách').click();
    fixture.detectChanges();
    expect(heading()).toBe('Danh sách chi tiết (1)');
    tile('Quá hạn chưa nộp').click();
    fixture.detectChanges();
    expect(heading()).toBe('Danh sách chi tiết (1)');
    expect(el.textContent).toContain('Tờ khai K3');
    tile('Quá hạn chưa nộp').click();
    fixture.detectChanges();
    expect(heading()).toBe('Danh sách chi tiết (3)');
  });
});
