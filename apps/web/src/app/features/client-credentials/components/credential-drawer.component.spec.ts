import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CredentialDetail } from '../data-access/client-credentials.api';
import { CredentialDrawerComponent } from './credential-drawer.component';

registerLocaleData(localeVi);

const token = (extra: Partial<CredentialDetail> = {}) =>
  ({
    id: 'k1',
    customerId: 'c1',
    type: 'DIGITAL_SIGNATURE',
    label: null,
    url: null,
    username: null,
    expiresAt: '2027-01-01',
    status: 'ACTIVE',
    statusNote: null,
    note: null,
    provider: 'VNPT_CA',
    serialNumber: 'TK-01',
    custody: 'OFFICE',
    storageLocation: 'Tủ A2',
    holder: null,
    loanedAt: null,
    loanDueAt: null,
    loanPurpose: null,
    secretChangedAt: null,
    secretChangedBy: null,
    hasSecret: true,
    daysToExpiry: 60,
    loanOverdue: false,
    revision: 1,
    updatedAt: '2026-10-30T00:00:00Z',
    customer: { id: 'c1', name: 'Công ty A', taxCode: '0100000001' },
    updatedBy: null,
    history: [
      {
        id: 'e1',
        type: 'BORROWED',
        note: 'Nộp tờ khai',
        detail: { holder: { id: 'u2', fullName: 'Nhân viên B' }, dueDate: '2026-11-02' },
        occurredAt: '2026-10-30T02:00:00Z',
        actor: { id: 'u2', fullName: 'Nhân viên B' },
      },
      {
        id: 'e0',
        type: 'CREATED',
        note: null,
        detail: { migrated: true },
        occurredAt: '2026-10-01T02:00:00Z',
        actor: null,
      },
    ],
    ...extra,
  }) as CredentialDetail;

const fresh = () => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzI18n(vi_VN)] });
};

describe('CredentialDrawerComponent (09-D)', () => {
  const dialogs: string[] = [];

  beforeEach(() => {
    dialogs.length = 0;
    fresh();
  });

  async function render(
    detail: CredentialDetail,
    can: { update?: boolean; delete?: boolean; secret?: boolean; me?: string; revealed?: string },
  ) {
    const fixture = TestBed.createComponent(CredentialDrawerComponent);
    const set = (name: string, value: unknown) => fixture.componentRef.setInput(name, value);
    set('detail', detail);
    set('canUpdate', !!can.update);
    set('canDelete', !!can.delete);
    set('canViewSecret', !!can.secret);
    set('currentUserId', can.me ?? 'u1');
    set('revealed', can.revealed ?? null);
    set('revealLeft', 25);
    fixture.componentInstance.dialog.subscribe((d) => dialogs.push(d));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  const labels = () =>
    [...document.body.querySelectorAll<HTMLButtonElement>('.ant-drawer .actions button')].map((b) =>
      b.textContent?.trim(),
    );
  const drawerText = () => document.body.querySelector('.ant-drawer')?.textContent ?? '';

  it('nhân viên, token tại văn phòng: chỉ mượn và báo lỗi; không xem PIN khi chưa được cấp', async () => {
    await render(token(), {});
    expect(labels()).toEqual(['Mượn token', 'Báo lỗi đăng nhập']);
    expect(drawerText()).not.toContain('Xem');
    expect(drawerText()).toContain('Tủ A2');
    expect(drawerText()).toContain('Dữ liệu chuyển đổi');
    expect(drawerText()).toContain('Nhân viên B · hạn trả 02/11/2026');
  });

  it('token đang mượn: người mượn được trả, người khác thì không; quản lý thu hồi / giao / trả khách, không xoá', async () => {
    const loaned = token({
      custody: 'LOANED',
      holder: { id: 'u2', fullName: 'Nhân viên B' },
      loanDueAt: '2026-10-29',
      loanOverdue: true,
    });
    await render(loaned, { me: 'u2' });
    expect(labels()).toEqual(['Trả token về văn phòng', 'Báo lỗi đăng nhập']);
    expect(drawerText()).toContain('Quá hạn trả');
    fresh();
    await render(loaned, { me: 'u3' });
    expect(labels()).toEqual(['Báo lỗi đăng nhập']);
    fresh();
    await render(loaned, { update: true, delete: true, me: 'u1' });
    expect(labels()).toEqual([
      'Sửa',
      'Trả token về văn phòng',
      'Giao token cho nhân viên',
      'Trả token cho khách hàng',
      'Báo lỗi đăng nhập',
    ]);
  });

  it('khách giữ: quản lý "Nhận từ khách", không mượn được; xoá khi không mượn; mật khẩu đang hiện có đếm ngược', async () => {
    await render(token({ custody: 'CUSTOMER', storageLocation: null }), {
      update: true,
      delete: true,
      secret: true,
      revealed: '12345678',
    });
    expect(labels()).toEqual(['Sửa', 'Nhận từ khách', 'Báo lỗi đăng nhập', 'Xoá tài khoản']);
    expect(drawerText()).toContain('12345678');
    expect(drawerText()).toContain('Tự ẩn sau 25 giây');
    const remove = [
      ...document.body.querySelectorAll<HTMLButtonElement>('.ant-drawer .actions button'),
    ].at(-1)!;
    remove.click();
    expect(dialogs).toEqual(['delete']);
  });
});
