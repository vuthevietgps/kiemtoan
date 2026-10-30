import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CredentialAction } from '../data-access/credentials.store';
import { CredentialActionFormComponent, defaultLoanDue } from './credential-action-form.component';

registerLocaleData(localeVi);

describe('CredentialActionFormComponent (09-D)', () => {
  let emitted: CredentialAction[];

  beforeEach(() => {
    emitted = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
  });

  async function render(mode: string) {
    const fixture = TestBed.createComponent(CredentialActionFormComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentInstance.submitted.subscribe((a) => emitted.push(a));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const submit = () => el.querySelector<HTMLButtonElement>('button[type=submit]')!;
    const type = async (text: string) => {
      const area = el.querySelector<HTMLTextAreaElement>('textarea')!;
      area.value = text;
      area.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, submit, type };
  }

  it('L4: hạn trả mặc định là ngày làm việc kế tiếp (thứ 6 → thứ 2)', () => {
    expect(defaultLoanDue(new Date(2026, 9, 30))).toEqual(new Date(2026, 10, 2)); // thứ 6 30/10
    expect(defaultLoanDue(new Date(2026, 9, 28))).toEqual(new Date(2026, 9, 29));
  });

  it('L10: xoá bắt buộc lý do; L7: báo lỗi bắt buộc ghi chú', async () => {
    const del = await render('delete');
    expect(del.submit().disabled).toBe(true);
    await del.type('Khách đổi đơn vị');
    expect(del.submit().disabled).toBe(false);
    del.submit().click();
    expect(emitted).toEqual([{ kind: 'delete', reason: 'Khách đổi đơn vị' }]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
    const report = await render('report');
    expect(report.submit().disabled).toBe(true);
    await report.type('Sai mật khẩu');
    report.submit().click();
    expect(emitted.at(-1)).toEqual({ kind: 'report', status: 'ERROR', note: 'Sai mật khẩu' });
  });

  it('mượn gửi hạn trả dạng ngày nghiệp vụ, mục đích tuỳ chọn', async () => {
    const borrow = await render('borrow');
    borrow.submit().click();
    const action = emitted[0] as Extract<CredentialAction, { kind: 'borrow' }>;
    expect(action.kind).toBe('borrow');
    expect(action.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(action.purpose).toBeNull();
  });
});
