import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { InvoiceDetail } from '../data-access/invoices.api';
import { InvoiceDrawerComponent } from './invoice-drawer.component';

registerLocaleData(localeVi);

const invoice = (status: string, kind = 'ORIGINAL', extra: Partial<InvoiceDetail> = {}) =>
  ({
    id: 'i1',
    kind,
    status,
    templateCode: status === 'REQUESTED' ? null : '1',
    symbol: status === 'REQUESTED' ? null : 'C25TAA',
    number: status === 'REQUESTED' ? null : '0000101',
    issueDate: null,
    subtotal: '5000000',
    vatAmount: '500000',
    total: '5500000',
    note: null,
    reason: null,
    migrated: false,
    revision: 1,
    buyerName: 'Công ty B',
    buyerTaxCode: '0100000001',
    buyerAddress: null,
    buyerEmail: null,
    contract: {
      id: 'c1',
      code: 'HD-1',
      customer: { id: 'k', name: 'Công ty B', taxCode: '0100000001' },
    },
    installments: [],
    documents: [],
    related: null,
    derived: [],
    events: [],
    lookupCode: null,
    taxAuthorityCode: null,
    issuedByName: null,
    ...extra,
  }) as unknown as InvoiceDetail;

describe('InvoiceDrawerComponent (08-C)', () => {
  let recorded: string[];
  let cancelled: string[];

  beforeEach(() => {
    recorded = [];
    cancelled = [];
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
  });

  async function render(detail: InvoiceDetail, can: { create?: boolean; update?: boolean }) {
    const fixture = TestBed.createComponent(InvoiceDrawerComponent);
    fixture.componentRef.setInput('detail', detail);
    fixture.componentRef.setInput('canCreate', !!can.create);
    fixture.componentRef.setInput('canUpdate', !!can.update);
    fixture.componentInstance.record.subscribe((m) => recorded.push(m));
    fixture.componentInstance.cancelRequest.subscribe((r) => cancelled.push(r));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  const buttons = () =>
    [...document.body.querySelectorAll<HTMLButtonElement>('.ant-drawer button')].filter((b) =>
      b.textContent?.trim(),
    );
  const button = (label: string) => buttons().find((b) => b.textContent?.trim() === label);

  it('chờ xuất: kế toán ghi nhận xuất / huỷ đề nghị (lý do ≥ 5 ký tự); KTT chỉ sửa người mua', async () => {
    const fixture = await render(invoice('REQUESTED'), { create: true, update: true });
    button('Ghi nhận đã xuất')!.click();
    expect(recorded).toEqual(['issue']);
    expect(button('Điều chỉnh')).toBeUndefined();
    button('Huỷ đề nghị')!.click();
    fixture.detectChanges();
    const textarea = document.body.querySelector<HTMLTextAreaElement>('.form textarea')!;
    const confirm = () =>
      buttons()
        .filter((b) => b.textContent?.trim() === 'Huỷ đề nghị')
        .at(-1)!;
    textarea.value = 'Sai';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirm().disabled).toBe(true);
    textarea.value = 'Khách gộp sang đợt sau';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    confirm().click();
    expect(cancelled).toEqual(['Khách gộp sang đợt sau']);
  });

  it('KTT (chỉ đề nghị): không có nút ghi nhận / huỷ, có sửa người mua', async () => {
    await render(invoice('REQUESTED'), { create: true });
    expect(button('Ghi nhận đã xuất')).toBeUndefined();
    expect(button('Huỷ đề nghị')).toBeUndefined();
    expect(button('Sửa người mua')).toBeTruthy();
  });

  it('K6: đã xuất → điều chỉnh, thay thế; đã điều chỉnh → chỉ điều chỉnh; hoá đơn điều chỉnh / bị thay thế → không thao tác', async () => {
    await render(invoice('ISSUED'), { update: true });
    expect(button('Điều chỉnh')).toBeTruthy();
    button('Thay thế')!.click();
    expect(recorded).toEqual(['replace']);
    for (const [status, kind, adjust, replace] of [
      ['ADJUSTED', 'ORIGINAL', true, false],
      ['ISSUED', 'ADJUSTMENT', false, false],
      ['REPLACED', 'ORIGINAL', false, false],
    ] as const) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideNoopAnimations(), provideNzI18n(vi_VN)],
      });
      await render(invoice(status, kind), { update: true });
      expect(!!button('Điều chỉnh')).toBe(adjust);
      expect(!!button('Thay thế')).toBe(replace);
    }
  });

  it('dữ liệu chuyển đổi không có file: hiện ghi chú', async () => {
    await render(invoice('ISSUED', 'ORIGINAL', { migrated: true }), {});
    expect(document.body.textContent).toContain('dữ liệu chuyển đổi');
  });
});
