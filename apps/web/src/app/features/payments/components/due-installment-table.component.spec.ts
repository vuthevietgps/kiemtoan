import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DueInstallment } from '../data-access/payments.api';
import { DueInstallmentTableComponent } from './due-installment-table.component';

registerLocaleData(localeVi);

const row = (id: string, dueInDays: number, overdueDays: number | null) =>
  ({
    id,
    name: `Đợt ${id}`,
    amount: '1000000',
    dueDate: '2026-10-01',
    remaining: '600000',
    dueInDays,
    overdueDays,
    bucket: overdueDays ? '31-60' : null,
    contract: { id: 'c1', code: 'HD-1', status: 'IN_PROGRESS' },
    customer: { id: 'k1', name: 'Công ty A' },
    owner: null,
    pendingAmount: '0',
  }) as DueInstallment;

describe('DueInstallmentTableComponent (07-D1)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
  });

  async function render(items: DueInstallment[], canCreate: boolean) {
    const fixture = TestBed.createComponent(DueInstallmentTableComponent);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('canCreate', canCreate);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('hiện tình trạng hạn: quá hạn N ngày / đến hạn hôm nay / còn N ngày', async () => {
    const fixture = await render([row('a', -45, 45), row('b', 0, null), row('c', 3, null)], false);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Quá hạn 45 ngày');
    expect(text).toContain('Đến hạn hôm nay');
    expect(text).toContain('Còn 3 ngày');
    expect(text).not.toContain('Lập phiếu');
  });

  it('người có quyền lập phiếu: bấm "Lập phiếu" phát đợt được chọn', async () => {
    const fixture = await render([row('a', -45, 45)], true);
    const picked: DueInstallment[] = [];
    fixture.componentInstance.collect.subscribe((i) => picked.push(i));
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Lập phiếu',
    )!;
    button.click();
    expect(picked.map((i) => i.id)).toEqual(['a']);
  });
});
