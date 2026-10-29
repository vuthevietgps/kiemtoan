import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { ObligationSetting } from '../data-access/obligations.api';
import { ObligationSettingsComponent, SettingChange } from './obligation-settings.component';

const settings: ObligationSetting[] = [
  { id: 't1', code: 'GTGT-T', name: 'Tờ khai GTGT', cycle: 'MONTHLY', byService: true, setting: null },
  {
    id: 't2',
    code: 'TNCN-Q',
    name: 'Tờ khai TNCN',
    cycle: 'QUARTERLY',
    byService: true,
    setting: { enabled: false, reason: 'KH tự nộp TNCN' },
  },
];

describe('ObligationSettingsComponent (06-D2, I4)', () => {
  function render(canUpdate: boolean) {
    const fixture = TestBed.createComponent(ObligationSettingsComponent);
    fixture.componentRef.setInput('settings', settings);
    fixture.componentRef.setInput('canUpdate', canUpdate);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent?.trim() === label,
      );
    return { fixture, el, button };
  }

  it('hiện trạng thái và lý do đã tắt; tắt cần lý do ≥ 5 ký tự rồi phát sự kiện', () => {
    const { fixture, el, button } = render(true);
    expect(el.textContent).toContain('Đang áp dụng');
    expect(el.textContent).toContain('KH tự nộp TNCN');
    expect(button('Bật lại')).toBeTruthy();
    const changes: SettingChange[] = [];
    fixture.componentInstance.changeSetting.subscribe((c) => changes.push(c));
    button('Tắt cho KH')!.click();
    fixture.detectChanges();
    const input = el.querySelector<HTMLInputElement>('.form input')!;
    input.value = 'Ngắn';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button('Xác nhận')!.disabled).toBe(true);
    input.value = 'KH tự nộp tờ khai GTGT';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Xác nhận')!.click();
    expect(changes).toEqual([{ typeId: 't1', enabled: false, reason: 'KH tự nộp tờ khai GTGT' }]);
  });

  it('không có quyền cập nhật: không có nút bật/tắt', () => {
    const { button } = render(false);
    expect(button('Tắt cho KH')).toBeUndefined();
    expect(button('Bật lại')).toBeUndefined();
  });
});
