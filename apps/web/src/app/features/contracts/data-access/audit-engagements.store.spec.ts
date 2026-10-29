import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditEngagementsStore } from './audit-engagements.store';
import { AuditTrackingApi, ContractAuditView } from './audit-tracking.api';
import { CommercialDocumentsApi } from './commercial-documents.api';
import { ContractsApi } from './contracts.api';

const view = (revision: number) =>
  ({
    contract: { id: 'c', code: 'HD', status: 'IN_PROGRESS' },
    dossier: { revision },
    engagements: [],
  }) as unknown as ContractAuditView;

describe('AuditEngagementsStore', () => {
  const api = { engagements: vi.fn(), save: vi.fn() };
  let store: AuditEngagementsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.engagements.mockReturnValue(of(view(1)));
    TestBed.configureTestingModule({
      providers: [
        AuditEngagementsStore,
        { provide: AuditTrackingApi, useValue: api },
        {
          provide: ContractsApi,
          useValue: {
            userOptions: () =>
              of([
                { id: 'u', fullName: 'User', role: 'STAFF' },
                { id: 'admin', fullName: 'Admin', role: 'ADMIN' },
              ]),
          },
        },
        {
          provide: CommercialDocumentsApi,
          useValue: {
            list: () =>
              of([
                { id: 'bbnt', type: 'ACCEPTANCE', source: 'SIGNED' },
                { id: 'draft', type: 'ACCEPTANCE', source: 'GENERATED' },
              ]),
          },
        },
      ],
    });
    store = TestBed.inject(AuditEngagementsStore);
  });

  it('tải hồ sơ, bỏ tài khoản quản trị, chỉ giữ bản BBNT đã ký', async () => {
    await store.load('c');
    expect(store.view()?.dossier.revision).toBe(1);
    expect(store.users().map((u) => u.id)).toEqual(['u']);
    expect(store.acceptanceDocs().map((d) => d.id)).toEqual(['bbnt']);
  });

  it('lệnh thành công thay dữ liệu; 409 tải lại và giữ thông báo lỗi', async () => {
    await store.load('c');
    api.save.mockReturnValueOnce(of(view(2)));
    expect(await store.save('line', { revision: 1 } as never)).toBe(true);
    expect(store.view()?.dossier.revision).toBe(2);

    api.engagements.mockReturnValue(of(view(5)));
    api.save.mockReturnValueOnce(
      throwError(() => ({ status: 409, error: { message: 'Người khác vừa sửa' } })),
    );
    expect(await store.save('line', { revision: 2 } as never)).toBe(false);
    expect(store.view()?.dossier.revision).toBe(5);
    expect(store.error()).toBe('Người khác vừa sửa');
  });
});
