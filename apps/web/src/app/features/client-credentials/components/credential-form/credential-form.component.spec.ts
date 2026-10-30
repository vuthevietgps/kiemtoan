import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CredentialInput } from '../../data-access/client-credentials.api';
import { CredentialFormComponent } from './credential-form.component';

registerLocaleData(localeVi);

describe('CredentialFormComponent (09-D, L1–L2)', () => {
  let emitted: CredentialInput[];

  beforeEach(() => {
    emitted = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
  });

  function render(defaultType: string) {
    const fixture = TestBed.createComponent(CredentialFormComponent);
    fixture.componentRef.setInput('customerId', 'c1');
    fixture.componentRef.setInput('defaultType', defaultType);
    fixture.componentInstance.submitted.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
    const access = fixture.componentInstance as unknown as {
      form: { patchValue(v: object): void; valid: boolean };
      submit(): void;
    };
    return { fixture, access };
  }

  it('token: bắt buộc nhà cung cấp, serial, hạn; PIN tuỳ chọn; không gửi tên đăng nhập', () => {
    const { access } = render('DIGITAL_SIGNATURE');
    access.submit();
    expect(emitted).toEqual([]);
    access.form.patchValue({
      provider: 'VNPT_CA',
      serialNumber: ' TK-01 ',
      expiresAt: new Date(2027, 0, 31),
      storageLocation: 'Tủ A2',
    });
    access.submit();
    expect(emitted[0]).toMatchObject({
      customerId: 'c1',
      type: 'DIGITAL_SIGNATURE',
      provider: 'VNPT_CA',
      serialNumber: 'TK-01',
      expiresAt: '2027-01-31',
      storageLocation: 'Tủ A2',
    });
    expect(emitted[0]).not.toHaveProperty('username');
    expect(emitted[0]).not.toHaveProperty('password');
  });

  it('loại "Khác" bắt buộc tên; tài khoản cổng bắt buộc tên đăng nhập + mật khẩu khi thêm', () => {
    const { access } = render('TAX_PORTAL');
    access.form.patchValue({ type: 'OTHER', username: 'u', password: 'p' });
    access.submit();
    expect(emitted).toEqual([]);
    access.form.patchValue({ label: 'Cổng hải quan' });
    access.submit();
    expect(emitted[0]).toMatchObject({
      type: 'OTHER',
      label: 'Cổng hải quan',
      username: 'u',
      password: 'p',
    });
  });
});
