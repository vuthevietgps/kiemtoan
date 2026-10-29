import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PaymentDetail } from '../data-access/payments.api';
import type { PaymentAction } from '../data-access/payments.store';
import { PaymentDrawerComponent } from './payment-drawer.component';

registerLocaleData(localeVi);

const CASHIER = 'u-cashier';
const DIRECTOR = 'u-director';
const base = {
  id: 'p1',
  code: 'PT-2026-0001',
  amount: '1000000',
  paidDate: '2026-10-01',
  method: 'BANK_TRANSFER',
  documentNumber: null,
  note: null,
  revision: 2,
  contract: { id: 'c1', code: 'HD-1', total: '5000000', customer: { id: 'k', name: 'Công ty A' } },
  installment: null,
  receivedBy: { id: CASHIER, fullName: 'Kế toán thu' },
  _count: { documents: 1 },
  returnReason: null,
  cancelReason: null,
  approvedAt: null,
  approvedByName: null,
  cancelledAt: null,
  cancelledByName: null,
  migrated: false,
  allocations: [],
  documents: [{ id: 'd1', fileName: 'sao-ke.pdf' }],
  events: [],
};
const payment = (status: string, extra: Partial<PaymentDetail> = {}) =>
  ({ ...base, status, ...extra }) as unknown as PaymentDetail;

describe('PaymentDrawerComponent (07-C, J1/J5)', () => {
  let actions: PaymentAction[];

  beforeEach(() => {
    actions = [];
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
  });

  async function render(
    detail: PaymentDetail,
    as: { userId: string; create?: boolean; approve?: boolean },
  ) {
    const fixture = TestBed.createComponent(PaymentDrawerComponent);
    fixture.componentRef.setInput('detail', detail);
    fixture.componentRef.setInput('userId', as.userId);
    fixture.componentRef.setInput('canCreate', !!as.create);
    fixture.componentRef.setInput('canApprove', !!as.approve);
    fixture.componentInstance.action.subscribe((a) => actions.push(a));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  const buttons = () =>
    [...document.body.querySelectorAll<HTMLButtonElement>('.ant-drawer button')].filter(
      (b) => b.textContent?.trim(),
    );
  const button = (label: string) => buttons().find((b) => b.textContent?.trim() === label);

  it('người lập, phiếu Nháp: gửi duyệt, sửa, rút, đính kèm/gỡ file; không có nút duyệt', async () => {
    await render(payment('DRAFT'), { userId: CASHIER, create: true });
    expect(button('Sửa')).toBeTruthy();
    expect(button('Rút phiếu')).toBeTruthy();
    expect(button('Đính kèm file')).toBeTruthy();
    button('Gỡ file')!.click();
    button('Gửi duyệt')!.click();
    expect(actions).toEqual([{ kind: 'detach', documentId: 'd1' }, { kind: 'submit' }]);
    expect(button('Duyệt')).toBeUndefined();
  });

  it('J1: người duyệt là người lập thì không có nút Duyệt / Trả lại, hiện ghi chú', async () => {
    await render(payment('PENDING'), { userId: CASHIER, create: true, approve: true });
    expect(button('Duyệt')).toBeUndefined();
    expect(button('Trả lại')).toBeUndefined();
    expect(button('Rút phiếu')).toBeTruthy();
    expect(document.body.textContent).toContain('Bạn là người lập');
  });

  it('người duyệt khác người lập: trả lại cần lý do ≥ 5 ký tự; không sửa được phiếu người khác', async () => {
    const fixture = await render(payment('PENDING'), { userId: DIRECTOR, approve: true });
    expect(button('Duyệt')).toBeTruthy();
    expect(button('Sửa')).toBeUndefined();
    expect(button('Gỡ file')).toBeUndefined();
    button('Trả lại')!.click();
    fixture.detectChanges();
    const textarea = document.body.querySelector<HTMLTextAreaElement>('.form textarea')!;
    const confirm = () => buttons().filter((b) => b.textContent?.trim() === 'Trả lại').at(-1)!;
    textarea.value = 'Sai';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirm().disabled).toBe(true);
    textarea.value = 'Thiếu sao kê đúng ngày';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    confirm().click();
    expect(actions).toEqual([{ kind: 'return', reason: 'Thiếu sao kê đúng ngày' }]);
  });

  it('J5: phiếu Đã duyệt chỉ người có quyền duyệt huỷ được; phiếu Đã huỷ hiện lý do, không còn thao tác', async () => {
    await render(payment('APPROVED'), { userId: CASHIER, create: true });
    expect(button('Huỷ phiếu')).toBeUndefined();
    expect(button('Rút phiếu')).toBeUndefined();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
    await render(payment('APPROVED'), { userId: DIRECTOR, approve: true });
    expect(button('Huỷ phiếu')).toBeTruthy();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
    await render(payment('CANCELLED', { cancelReason: 'Nhập nhầm hợp đồng' }), {
      userId: DIRECTOR,
      approve: true,
    });
    expect(document.body.textContent).toContain('Nhập nhầm hợp đồng');
    expect(button('Huỷ phiếu')).toBeUndefined();
  });
});
