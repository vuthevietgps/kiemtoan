import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { APP_ICONS } from '../../../../core/icons/app-icons';
import { WorkflowStep } from '../../data-access/workflows.api';
import { WorkflowStepFormComponent } from './workflow-step-form.component';

registerLocaleData(localeVi);

const base: WorkflowStep = {
  key: 'B06', phase: 'Rà soát dữ liệu', name: 'Kiểm tra lương, BHXH', instructions: null, required: true,
  durationDays: 5, dueOffsetDays: null, performerRole: 'STAFF', defaultAssigneeId: null, reviewLevels: 1,
  reviewerRole: 'MANAGER', defaultReviewerId: null, defaultApproverId: null, requiresEvidence: true,
  evidenceHint: null, dependsOn: ['B05'],
};
const previous: WorkflowStep = { ...base, key: 'B05', name: 'Kiểm tra hóa đơn', dependsOn: ['B04'] };

describe('WorkflowStepFormComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzIcons(APP_ICONS), provideNzI18n(vi_VN)] }),
  );

  function setup(step: WorkflowStep = base) {
    const fixture = TestBed.createComponent(WorkflowStepFormComponent);
    fixture.componentRef.setInput('step', step);
    fixture.componentRef.setInput('mode', 'PROJECT');
    fixture.componentRef.setInput('previous', previous);
    fixture.componentRef.setInput('users', [{ id: 'u1', fullName: 'Lê Văn An', role: 'STAFF' }]);
    fixture.detectChanges();
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    const form = fixture.componentInstance['form'];
    const send = () => fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    return { fixture, form, submitted, send };
  }

  it('"parallel with previous" copies the previous step dependencies', () => {
    const { fixture, submitted, send } = setup();
    fixture.componentInstance['parallelWithPrevious']();
    send();
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ key: 'B06', dependsOn: ['B04'] }));
  });

  it('keeps the default assignee and drops reviewer people when review levels are removed', () => {
    const { form, submitted, send } = setup({ ...base, defaultReviewerId: 'u1', reviewLevels: 2, defaultApproverId: 'u1' });
    form.patchValue({ defaultAssigneeId: 'u1', reviewLevels: 0 });
    send();
    expect(submitted).toHaveBeenCalledWith(
      expect.objectContaining({ defaultAssigneeId: 'u1', reviewerRole: null, defaultReviewerId: null, defaultApproverId: null }),
    );
  });

  it('rejects a too-short step name', () => {
    const { form, submitted, send } = setup();
    form.patchValue({ name: 'a' });
    send();
    expect(submitted).not.toHaveBeenCalled();
  });

  it('06 (I6): bước pháp lý chọn loại nghĩa vụ; bỏ cờ pháp lý thì bỏ loại nghĩa vụ', () => {
    const { fixture, form, submitted, send } = setup();
    fixture.componentRef.setInput('obligationTypes', [{ id: 'o1', code: 'GTGT-THANG', name: 'Tờ khai GTGT tháng', retiredAt: null }]);
    expect(fixture.nativeElement.querySelector('[formcontrolname="obligationTypeId"]')).toBeNull();
    form.patchValue({ isStatutory: true, requiresDelivery: true, obligationTypeId: 'o1' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formcontrolname="obligationTypeId"]')).not.toBeNull();
    send();
    expect(submitted).toHaveBeenLastCalledWith(
      expect.objectContaining({ isStatutory: true, requiresDelivery: true, obligationTypeId: 'o1' }),
    );
    form.patchValue({ isStatutory: false });
    send();
    expect(submitted).toHaveBeenLastCalledWith(expect.objectContaining({ isStatutory: false, obligationTypeId: null }));
  });

  it('giữ cờ pháp lý và loại nghĩa vụ của bước khi mở lại form', () => {
    const { submitted, send } = setup({ ...base, isStatutory: true, requiresDelivery: true, obligationTypeId: 'o1' });
    send();
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ isStatutory: true, obligationTypeId: 'o1' }));
  });

  it('H1: bật hạn pháp lý thì mặc định bật cần xác nhận giao nộp', () => {
    const { form, submitted, send } = setup();
    form.controls.isStatutory.setValue(true);
    send();
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ isStatutory: true, requiresDelivery: true }));
  });
});
