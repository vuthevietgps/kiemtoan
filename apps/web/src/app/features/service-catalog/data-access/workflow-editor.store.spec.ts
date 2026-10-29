import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { WorkflowEditorStore, nextStepKey, withoutStep } from './workflow-editor.store';
import { WorkflowsApi, WorkflowStep, WorkflowVersion } from './workflows.api';

const step = (key: string, dependsOn: string[] = []) => ({ key, name: key, dependsOn }) as unknown as WorkflowStep;
const version = {
  id: 'v2', versionNo: 2, status: 'DRAFT', scheduleMode: 'PROJECT', revision: 3, note: null,
  template: { id: 't1' }, steps: [{ ...step('B01'), id: 'internal' }], requirements: [],
} as unknown as WorkflowVersion;

describe('workflow editor helpers', () => {
  it('generates the first unused step key', () => {
    expect(nextStepKey([step('B01'), step('B03')])).toBe('B04');
    expect(nextStepKey([])).toBe('B01');
  });

  it('removes a step and every dependency pointing to it', () => {
    expect(withoutStep([step('B01'), step('B02', ['B01']), step('B03', ['B01', 'B02'])], 'B01')).toEqual([
      step('B02'),
      step('B03', ['B02']),
    ]);
  });
});

describe('WorkflowEditorStore', () => {
  function setup(save = vi.fn(() => of(version))) {
    const api = { save, template: vi.fn(() => of({ id: 't1' })), version: vi.fn(() => of(version)), userOptions: vi.fn(() => of([])) };
    TestBed.configureTestingModule({ providers: [WorkflowEditorStore, { provide: WorkflowsApi, useValue: api }] });
    const store = TestBed.inject(WorkflowEditorStore);
    return { store, api };
  }

  it('sends only the editable step fields with the current revision', async () => {
    const { store, api } = setup();
    await store.selectVersion('v2');
    await store.save();
    const body = (api.save.mock.calls[0] as unknown[])[1] as { revision: number; steps: Record<string, unknown>[] };
    expect(body.revision).toBe(3);
    expect(body.steps[0]).not.toHaveProperty('id');
    expect(Object.keys(body.steps[0])).toContain('dependsOn');
  });

  it('keeps unsaved edits and shows the error when saving fails (e.g. revision conflict)', async () => {
    const { store } = setup(vi.fn(() => throwError(() => ({ error: { message: 'Bản nháp đã được người khác sửa' } }))));
    await store.selectVersion('v2');
    store.setSteps([step('B01'), step('B02', ['B01'])]);
    expect(await store.save()).toBe(false);
    expect(store.error()).toBe('Bản nháp đã được người khác sửa');
    expect(store.dirty()).toBe(true);
    expect(store.steps()).toHaveLength(2);
  });

  it('hồi quy 05-B/06: lưu nháp giữ cờ hạn pháp lý, giao nộp và loại nghĩa vụ của bước', async () => {
    const { store, api } = setup();
    await store.selectVersion('v2');
    store.setSteps([{ ...step('B01'), isStatutory: true, requiresDelivery: true, obligationTypeId: 'o1' }]);
    await store.save();
    const body = (api.save.mock.calls[0] as unknown[])[1] as { steps: Record<string, unknown>[] };
    expect(body.steps[0]).toMatchObject({ isStatutory: true, requiresDelivery: true, obligationTypeId: 'o1' });
  });
});
