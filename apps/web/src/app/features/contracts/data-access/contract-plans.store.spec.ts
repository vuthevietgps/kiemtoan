import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ContractPlansApi } from './contract-plans.api';
import { ContractPlansStore } from './contract-plans.store';
import { ContractsApi } from './contracts.api';

function setup(update = vi.fn(() => of({}))) {
  const api = {
    list: vi.fn(() => of({ contractId: 'c1', status: 'DRAFT', lines: [] })),
    update,
    create: vi.fn(() => of({})),
    confirm: vi.fn(() => of({})),
    reopen: vi.fn(() => of({})),
    preview: vi.fn(() =>
      of([
        {
          stepKey: 'B01',
          skipped: false,
          plannedStart: '2026-11-09T00:00:00.000Z',
          dueDate: '2026-11-10T00:00:00.000Z',
        },
      ]),
    ),
  };
  const contractsApi = {
    userOptions: vi.fn(() =>
      of([
        { id: 'u1', fullName: 'Nhân viên', role: 'STAFF' },
        { id: 'a1', fullName: 'Quản trị', role: 'ADMIN' },
      ]),
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      ContractPlansStore,
      { provide: ContractPlansApi, useValue: api },
      { provide: ContractsApi, useValue: contractsApi },
    ],
  });
  return { store: TestBed.inject(ContractPlansStore), api };
}

describe('ContractPlansStore', () => {
  it('merges step changes and sends them with the plan revision', async () => {
    const { store, api } = setup();
    await store.load('c1');
    store.change('p1', 'B01', { skipped: true });
    store.change('p1', 'B01', { assigneeId: 'u2' });
    store.change('p1', 'B02', { durationDays: 3 });
    expect(store.hasChanges('p1')).toBe(true);
    expect(store.hasChanges('p2')).toBe(false);

    expect(await store.save('p1', 4)).toBe(true);
    expect(api.update).toHaveBeenCalledWith('p1', {
      revision: 4,
      steps: [
        { stepKey: 'B01', skipped: true, assigneeId: 'u2' },
        { stepKey: 'B02', durationDays: 3 },
      ],
    });
    expect(store.hasChanges('p1')).toBe(false);
  });

  it('keeps unsaved changes and shows the error when saving conflicts', async () => {
    const conflict = new HttpErrorResponse({
      status: 409,
      error: { message: 'Kế hoạch đã được người khác sửa' },
    });
    const { store } = setup(vi.fn(() => throwError(() => conflict)));
    await store.load('c1');
    store.change('p1', 'B01', { skipped: true });

    expect(await store.save('p1', 1)).toBe(false);
    expect(store.error()).toContain('người khác sửa');
    expect(store.hasChanges('p1')).toBe(true);
  });

  it('offers only non-admin users and keeps the same list on reload', async () => {
    const { store } = setup();
    await store.load('c1');
    const users = store.users();
    expect(users.map((u) => u.id)).toEqual(['u1']);
    await store.load('c1');
    expect(store.users()).toBe(users);
  });

  it('creates a plan with the chosen workflow version only when one is given', async () => {
    const { store, api } = setup();
    await store.load('c1');
    await store.create('line1', 'v3');
    await store.create('line2', null);
    expect(api.create).toHaveBeenNthCalledWith(1, 'c1', 'line1', { workflowVersionId: 'v3' });
    expect(api.create).toHaveBeenNthCalledWith(2, 'c1', 'line2', {});
  });
});

describe('ContractPlansStore preview and header changes', () => {
  it('previews the schedule once after edits settle, using a valid period only', async () => {
    vi.useFakeTimers();
    try {
      const { store, api } = setup();
      await store.load('c1');
      store.change('p1', 'B01', { durationDays: 4 });
      store.changeHeader('p1', { period: '2025-' });
      store.changeHeader('p1', { startDate: '2026-11-09' });
      await vi.advanceTimersByTimeAsync(400);
      expect(api.preview).toHaveBeenCalledTimes(1);
      expect(api.preview).toHaveBeenCalledWith('p1', {
        startDate: '2026-11-09',
        period: undefined,
        steps: [{ stepKey: 'B01', durationDays: 4 }],
      });
      expect(store.previews()['p1']['B01'].dueDate).toBe('2026-11-10T00:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves header changes with the steps and discards a plan without touching others', async () => {
    const { store, api } = setup();
    await store.load('c1');
    store.changeHeader('p1', { note: 'Ghi chú' });
    store.change('p2', 'B01', { skipped: true });
    expect(store.hasChanges('p1')).toBe(true);
    await store.save('p1', 2);
    expect(api.update).toHaveBeenCalledWith('p1', { note: 'Ghi chú', revision: 2, steps: [] });

    store.changeHeader('p1', { note: 'x' });
    store.change('p2', 'B01', { skipped: true });
    store.discard('p1');
    expect(store.hasChanges('p1')).toBe(false);
    expect(store.hasChanges('p2')).toBe(true);
  });
});
