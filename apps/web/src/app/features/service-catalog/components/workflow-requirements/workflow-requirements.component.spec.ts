import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { APP_ICONS } from '../../../../core/icons/app-icons';
import { DocumentRequirement, WorkflowStep } from '../../data-access/workflows.api';
import { WorkflowRequirementsComponent } from './workflow-requirements.component';

registerLocaleData(localeVi);

const step = { key: 'B02', name: 'Lập hồ sơ đề nghị hoàn thuế' } as WorkflowStep;
const existing: DocumentRequirement = {
  name: 'Tờ khai thuế GTGT', instructions: null, required: true, category: 'SERVICE', perPeriod: true, stepKey: 'B02',
};

describe('WorkflowRequirementsComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideNzIcons(APP_ICONS), provideNzI18n(vi_VN)] }),
  );

  function setup() {
    const fixture = TestBed.createComponent(WorkflowRequirementsComponent);
    fixture.componentRef.setInput('requirements', [existing]);
    fixture.componentRef.setInput('steps', [step]);
    fixture.detectChanges();
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    const form = fixture.componentInstance['form'];
    const send = () => fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    return { fixture, form, changed, send };
  }

  it('adds an optional requirement linked to a step and emits the whole list', () => {
    const { form, changed, send } = setup();
    form.patchValue({ name: ' Hồ sơ xuất khẩu ', required: false, stepKey: 'B02', instructions: ' Nếu có ' });
    send();
    expect(changed).toHaveBeenCalledWith([
      existing,
      { name: 'Hồ sơ xuất khẩu', category: 'SERVICE', required: false, perPeriod: false, stepKey: 'B02', instructions: 'Nếu có' },
    ]);
  });

  it('rejects a duplicate name regardless of case', () => {
    const { form, changed, send } = setup();
    form.patchValue({ name: 'tờ khai THUẾ gtgt' });
    send();
    expect(changed).not.toHaveBeenCalled();
  });

  it('hides editing controls when the version is read-only', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('readonly', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
});
