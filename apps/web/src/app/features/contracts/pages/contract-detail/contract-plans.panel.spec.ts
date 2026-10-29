import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { ContractPlansApi } from '../../data-access/contract-plans.api';
import { ContractDetail, ContractsApi } from '../../data-access/contracts.api';
import { ContractPlansPanel } from './contract-plans.panel';

describe('ContractPlansPanel', () => {
  it('loads plans once per contract load, not again when the store updates', async () => {
    const plansApi = { list: vi.fn(() => of({ status: 'DRAFT', lines: [] })) };
    const contractsApi = {
      userOptions: vi.fn(() =>
        of([
          { id: 'u1', fullName: 'Nhân viên', role: 'STAFF' },
          { id: 'a1', fullName: 'Quản trị', role: 'ADMIN' },
        ]),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [ContractPlansPanel],
      providers: [
        { provide: ContractPlansApi, useValue: plansApi },
        { provide: ContractsApi, useValue: contractsApi },
        { provide: AuthService, useValue: { can: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
        { provide: NzModalService, useValue: { confirm: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ContractPlansPanel);
    const contract = { id: 'c1', status: 'DRAFT' } as ContractDetail;
    fixture.componentRef.setInput('contract', contract);
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    expect(plansApi.list).toHaveBeenCalledTimes(1);

    // Trang HĐ tải lại (object mới) thì panel tải lại đúng một lần.
    fixture.componentRef.setInput('contract', { ...contract });
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    expect(plansApi.list).toHaveBeenCalledTimes(2);
    expect(contractsApi.userOptions).toHaveBeenCalledTimes(1);
  });
});
