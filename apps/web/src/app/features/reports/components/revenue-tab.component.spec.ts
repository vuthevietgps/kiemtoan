import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { provideEchartsCore } from 'ngx-echarts';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_ICONS } from '../../../core/icons/app-icons';
import { FinanceReportsApi, RevenueMeasuresReport } from '../data-access/finance-reports.api';
import { RevenueTabComponent } from './revenue-tab.component';

registerLocaleData(localeVi);
// Biểu đồ echarts cần ResizeObserver; môi trường test không có.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

const measure = (contractValue: string, invoiced: string | null, paid: string | null) => ({
  contracts: 1,
  contractValue,
  invoiced,
  paid,
  previous: { contractValue: '0', invoiced: '0', paid: '0' },
  change: { contractValue: null, invoiced: null, paid: null },
});
const keys = (customerId: string, n: string) => ({
  contractId: `c${n}`,
  contractCode: `HD-${n}`,
  customerId,
  customerName: customerId === 'k1' ? 'Công ty A' : 'Công ty B',
  ownerId: 'u1',
  month: '2026-10',
  date: '2026-10-05',
  amount: '100',
});
const report: RevenueMeasuresReport = {
  from: '2026-01-01',
  to: '2026-12-31',
  previousFrom: '2025-01-01',
  previousTo: '2025-12-31',
  groupBy: 'customer',
  rows: [
    { key: 'k1', name: 'Công ty A', ...measure('1000', '350', '330') },
    { key: 'k2', name: 'Công ty B', ...measure('2000', '0', '1100') },
  ],
  totals: { ...measure('3000', '350', '1430'), contracts: 2 },
  details: {
    contracts: [
      { ...keys('k1', '1'), serviceTypeIds: ['s1'] },
      { ...keys('k2', '2'), serviceTypeIds: ['s1'] },
    ],
    invoices: [{ ...keys('k1', '1'), id: 'i1', kind: 'ORIGINAL', identity: '1 · C26 · 01' }],
    payments: [
      { ...keys('k1', '1'), id: 'p1', code: 'PT-1' },
      { ...keys('k2', '2'), id: 'p2', code: 'PT-2' },
    ],
  },
};

describe('RevenueTabComponent (10-D, M4)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzI18n(vi_VN),
        provideNzIcons(APP_ICONS),
        provideEchartsCore({ echarts: () => import('echarts') }),
        {
          provide: FinanceReportsApi,
          useValue: { revenue: vi.fn(() => of(report)), exportFile: vi.fn() },
        },
        {
          provide: AuthService,
          useValue: { can: () => true, user: () => null, permissions: () => new Set<string>() },
        },
      ],
    });
  });

  it('bấm một nhóm → chi tiết chỉ còn HĐ / hoá đơn / phiếu thu của nhóm đó; bấm lại bỏ chọn', async () => {
    const fixture = TestBed.createComponent(RevenueTabComponent);
    fixture.componentRef.setInput('from', '2026-01-01');
    fixture.componentRef.setInput('to', '2026-12-31');
    (fixture.componentInstance as unknown as { changeGroup(g: string): void }).changeGroup(
      'customer',
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = () => [...el.querySelectorAll('.ant-tabs-tab')].map((t) => t.textContent?.trim());
    expect(tabs()).toEqual(['Hợp đồng duyệt (2)', 'Hoá đơn (1)', 'Phiếu thu (2)']);
    const row = () => el.querySelectorAll<HTMLTableRowElement>('tr.row')[1];
    row().click();
    fixture.detectChanges();
    expect(tabs()).toEqual(['Hợp đồng duyệt (1)', 'Hoá đơn (0)', 'Phiếu thu (1)']);
    expect(el.querySelector('h4')?.textContent).toContain('Công ty B');
    row().click();
    fixture.detectChanges();
    expect(tabs()).toEqual(['Hợp đồng duyệt (2)', 'Hoá đơn (1)', 'Phiếu thu (2)']);
  });

  it('theo loại dịch vụ: chi tiết chỉ còn hợp đồng có dịch vụ đó, không có hoá đơn / phiếu thu', async () => {
    const fixture = TestBed.createComponent(RevenueTabComponent);
    fixture.componentRef.setInput('from', '2026-01-01');
    fixture.componentRef.setInput('to', '2026-12-31');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const instance = fixture.componentInstance as unknown as {
      pick(row: { key: string; name: string }): void;
    };
    instance.pick({ key: 's1', name: 'Kế toán thuế' });
    fixture.detectChanges();
    expect([...el.querySelectorAll('.ant-tabs-tab')].map((t) => t.textContent?.trim())).toEqual([
      'Hợp đồng duyệt (2)',
      'Hoá đơn (0)',
      'Phiếu thu (0)',
    ]);
  });
});
