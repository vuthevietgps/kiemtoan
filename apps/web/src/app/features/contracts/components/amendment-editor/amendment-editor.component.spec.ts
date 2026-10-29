import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it } from 'vitest';
import { APP_ICONS } from '../../../../core/icons/app-icons';
import { Amendment, AmendmentInput } from '../../data-access/contract-lifecycle.api';
import { ContractServiceLine } from '../../data-access/contracts.api';
import { AmendmentEditorComponent } from './amendment-editor.component';

registerLocaleData(localeVi);

const line = (id: string, unitPrice: string) =>
  ({
    id,
    serviceTypeId: `t-${id}`,
    serviceType: { name: id },
    period: '2026',
    quantity: 1,
    unitPrice,
  }) as unknown as ContractServiceLine;

interface EditorApi {
  title: { set: (v: string) => void };
  patchRow: (i: number, patch: object) => void;
  addRow: () => void;
  chooseType: (i: number, id: string) => void;
  patchAdded: (i: number, patch: object) => void;
  submit: () => void;
  error: () => string;
}

async function setup(initial: Amendment | null = null) {
  await TestBed.configureTestingModule({
    imports: [AmendmentEditorComponent],
    providers: [provideNoopAnimations(), provideNzIcons(APP_ICONS), provideNzI18n(vi_VN)],
  }).compileComponents();
  const fixture = TestBed.createComponent(AmendmentEditorComponent);
  fixture.componentRef.setInput('services', [line('a', '1000000'), line('b', '2000000')]);
  fixture.componentRef.setInput('serviceTypes', [
    { id: 't-c', name: 'C', defaultPrice: '750000', isActive: true },
  ]);
  fixture.componentRef.setInput('initial', initial);
  fixture.detectChanges();
  await fixture.whenStable();
  const emitted: AmendmentInput[] = [];
  fixture.componentInstance.save.subscribe((v) => emitted.push(v));
  return { editor: fixture.componentInstance as unknown as EditorApi, emitted };
}

describe('AmendmentEditorComponent', () => {
  it('emits only changed lines: update, remove and a new line with the default price', async () => {
    const { editor, emitted } = await setup();
    editor.title.set('Điều chỉnh 2027');
    editor.patchRow(0, { mode: 'UPDATE', unitPrice: 1500000 });
    editor.patchRow(1, { mode: 'REMOVE' });
    editor.addRow();
    editor.chooseType(0, 't-c');
    editor.patchAdded(0, { quantity: 2, period: '2027' });
    editor.submit();
    expect(emitted).toEqual([
      {
        title: 'Điều chỉnh 2027',
        content: null,
        effectiveDate: null,
        lines: [
          { action: 'UPDATE', contractServiceId: 'a', quantity: 1, unitPrice: '1500000' },
          { action: 'REMOVE', contractServiceId: 'b' },
          { action: 'ADD', serviceTypeId: 't-c', period: '2027', quantity: 2, unitPrice: '750000' },
        ],
      },
    ]);
  });

  it('requires a title and at least one change', async () => {
    const { editor, emitted } = await setup();
    editor.submit();
    expect(editor.error()).toBe('Tiêu đề từ 2 đến 200 ký tự');
    editor.title.set('Không đổi gì');
    editor.submit();
    expect(editor.error()).toBe('Chọn ít nhất một thay đổi');
    expect(emitted).toEqual([]);
  });

  it('restores a draft amendment for editing', async () => {
    const draft = {
      title: 'Nháp',
      content: null,
      effectiveDate: '2027-01-01T00:00:00.000Z',
      lines: [{ action: 'UPDATE', contractServiceId: 'b', quantity: 3, unitPrice: '2100000' }],
    } as unknown as Amendment;
    const { editor, emitted } = await setup(draft);
    editor.submit();
    expect(emitted[0]).toMatchObject({
      title: 'Nháp',
      effectiveDate: '2027-01-01',
      lines: [{ action: 'UPDATE', contractServiceId: 'b', quantity: 3, unitPrice: '2100000' }],
    });
  });
});
