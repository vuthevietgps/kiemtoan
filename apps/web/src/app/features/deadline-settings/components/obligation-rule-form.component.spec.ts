import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { describe, expect, it } from 'vitest';
import type { CreateTypeInput, RuleInput } from '../data-access/deadline-settings.api';
import { ObligationRuleFormComponent } from './obligation-rule-form.component';

registerLocaleData(localeVi);

describe('ObligationRuleFormComponent (06-D3, I1)', () => {
  function render(mode: 'create' | 'draft', value: RuleInput | null = null) {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
    const fixture = TestBed.createComponent(ObligationRuleFormComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture;
  }

  it('tạo mới: chuẩn hoá mã in hoa, bỏ điều kiện trống, chưa đủ mã/tên thì không gửi được', () => {
    const fixture = render('create');
    const form = (fixture.componentInstance as unknown as { form: { patchValue: (v: object) => void } }).form;
    const created: CreateTypeInput[] = [];
    fixture.componentInstance.created.subscribe((v) => created.push(v));
    const submit = () =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(submit().disabled).toBe(true);
    form.patchValue({
      code: 'gtgt-thang',
      name: 'Tờ khai GTGT tháng',
      effectiveFrom: new Date(2027, 0, 1),
      conditions: { taxPeriod: ['MONTHLY'] },
    });
    fixture.detectChanges();
    submit().click();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      code: 'GTGT-THANG',
      effectiveFrom: '2027-01-01',
      name: 'Tờ khai GTGT tháng',
      cycle: 'MONTHLY',
      dueRule: 'MONTH_AFTER_END',
      monthsAfter: 1,
      dueMonth: null,
      dueDay: 20,
      conditions: { taxPeriod: ['MONTHLY'] },
      legalBasis: null,
    });
    expect(created[0].family).toBeUndefined();
  });

  it('sửa nháp: nạp giá trị hiện có; quy tắc ngày cố định gửi tháng hạn, bỏ số tháng sau kỳ', () => {
    const fixture = render('draft', {
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      dueRule: 'FIXED_IN_YEAR',
      monthsAfter: null,
      dueMonth: 3,
      dueDay: 31,
      useFiscalYear: true,
      holidayShift: 'NEXT',
      conditions: { accountingRegime: ['TT200'] },
      legalBasis: 'Ví dụ',
      note: null,
    });
    const saved: RuleInput[] = [];
    fixture.componentInstance.saved.subscribe((v) => saved.push(v));
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    expect(saved[0]).toMatchObject({
      effectiveFrom: '2026-01-01',
      dueRule: 'FIXED_IN_YEAR',
      monthsAfter: null,
      dueMonth: 3,
      dueDay: 31,
      conditions: { accountingRegime: ['TT200'] },
      legalBasis: 'Ví dụ',
    });
  });
});
