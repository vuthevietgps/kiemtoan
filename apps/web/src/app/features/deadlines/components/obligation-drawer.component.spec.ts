import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ObligationDetail } from '../data-access/obligations.api';
import type { ObligationAction } from '../data-access/obligations.store';
import { toDateKey } from '../../../shared/utils/date-key';
import { ObligationDrawerComponent } from './obligation-drawer.component';

registerLocaleData(localeVi);

const base = {
  id: 'o1',
  customerId: 'c1',
  period: '2026-09',
  periodEnd: '2026-09-30',
  dueDate: '2026-10-20',
  originalDueDate: '2026-10-20',
  filedAt: null,
  filedLate: false,
  note: null,
  revision: 3,
  customer: { id: 'c1', name: 'Công ty A', taxCode: '0100000001', owner: null },
  obligationType: { id: 't', code: 'GTGT-T', name: 'Tờ khai GTGT', group: 'TAX', cycle: 'MONTHLY' },
  receiptDocument: null,
  tasks: [],
  version: { versionNo: 1, legalBasis: null },
  events: [],
};
const obligation = (status: string, displayStatus = status) =>
  ({ ...base, status, displayStatus }) as unknown as ObligationDetail;

describe('ObligationDrawerComponent (06-D2, I7)', () => {
  let actions: ObligationAction[];

  beforeEach(() => {
    actions = [];
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
  });

  async function render(detail: ObligationDetail, can: { update?: boolean; approve?: boolean }) {
    const fixture = TestBed.createComponent(ObligationDrawerComponent);
    fixture.componentRef.setInput('detail', detail);
    fixture.componentRef.setInput('canUpdate', !!can.update);
    fixture.componentRef.setInput('canApprove', !!can.approve);
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

  it('quá hạn chưa nộp: nhãn "Trễ hạn"; đủ 3 thao tác; Đang chuẩn bị phát sự kiện', async () => {
    await render(obligation('NOT_DUE', 'OVERDUE'), { update: true });
    expect(document.body.textContent).toContain('Trễ hạn');
    expect(button('Đánh dấu đã nộp')).toBeTruthy();
    expect(button('Không áp dụng')).toBeTruthy();
    button('Đang chuẩn bị')!.click();
    expect(actions).toEqual([{ kind: 'prepare' }]);
    expect(button('Mở lại')).toBeUndefined();
  });

  it('đã nộp cần biên nhận: chưa chọn file thì không xác nhận được', async () => {
    const fixture = await render(obligation('PREPARING'), { update: true });
    expect(button('Đang chuẩn bị')).toBeUndefined();
    button('Đánh dấu đã nộp')!.click();
    fixture.detectChanges();
    expect(button('Xác nhận')!.disabled).toBe(true);
    const input = document.body.querySelector<HTMLInputElement>('input[type=file]')!;
    const file = new File(['x'], 'bien-nhan.pdf');
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    button('Xác nhận')!.click();
    expect(actions).toEqual([{ kind: 'file', filedAt: toDateKey(new Date()), file, note: undefined }]);
  });

  it('mở lại chỉ với quyền duyệt và cần lý do ≥ 5 ký tự; không có quyền cập nhật thì không có thao tác', async () => {
    const fixture = await render(obligation('FILED'), { update: true, approve: true });
    expect(button('Đánh dấu đã nộp')).toBeUndefined();
    button('Mở lại')!.click();
    fixture.detectChanges();
    const textarea = document.body.querySelector<HTMLTextAreaElement>('.form textarea')!;
    textarea.value = 'Sai';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const confirm = () => buttons().filter((b) => b.textContent?.trim() === 'Mở lại').at(-1)!;
    expect(confirm().disabled).toBe(true);
    textarea.value = 'Nộp bổ sung tờ khai';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    confirm().click();
    expect(actions).toEqual([{ kind: 'reopen', reason: 'Nộp bổ sung tờ khai' }]);
  });

  it('chỉ có quyền xem: không hiện nút thao tác', async () => {
    await render(obligation('NOT_DUE'), {});
    expect(button('Đánh dấu đã nộp')).toBeUndefined();
    expect(button('Đang chuẩn bị')).toBeUndefined();
  });
});
