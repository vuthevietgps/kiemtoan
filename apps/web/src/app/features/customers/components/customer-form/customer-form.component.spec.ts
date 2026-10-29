import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CustomerFormComponent } from './customer-form.component';

describe('CustomerFormComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({providers: [provideNoopAnimations()]}));
  function setup() {
    const fixture = TestBed.createComponent(CustomerFormComponent);
    fixture.detectChanges();
    const submit = vi.fn(); fixture.componentInstance.submitted.subscribe(submit);
    const fill = (name: string, value: string) => {
      const field = fixture.nativeElement.querySelector(`[formcontrolname="${name}"]`) as HTMLInputElement;
      field.value = value; field.dispatchEvent(new Event('input'));
    };
    return {fixture, submit, fill};
  }
  it('rejects whitespace-only names and malformed tax identifiers', () => {
    const {fixture, submit, fill} = setup(); fill('name','   '); fill('taxCode','123');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(submit).not.toHaveBeenCalled();
  });
  it('preserves leading zeros and emits a validated payload without API calls', () => {
    const {fixture, submit, fill} = setup(); fill('name',' Customer '); fill('taxCode','0012345678'); fill('contactPhone','0900123456');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({name: 'Customer', taxCode: '0012345678', contactPhone: '0900123456', ownerId: null}));
  });
  it('does not emit while a save is pending', () => {
    const {fixture, submit, fill} = setup(); fill('name','Customer'); fill('taxCode','0012345678');
    fixture.componentRef.setInput('saving',true); fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(submit).not.toHaveBeenCalled();
  });
  it('06 (I5): gửi trường thuế – kế toán; mặc định năm tài chính tháng 12, chưa chọn là null', () => {
    const {fixture, submit, fill} = setup(); fill('name','Customer'); fill('taxCode','0012345678');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({fiscalYearEndMonth: 12, vatMethod: null, pitPeriod: null, accountingRegime: null, taxAuthority: null}));
    fixture.componentInstance['form'].patchValue({fiscalYearEndMonth: 3, vatMethod: 'DEDUCTION', pitPeriod: 'QUARTERLY', accountingRegime: 'TT133'});
    fill('taxAuthority','Chi cục Thuế khu vực I');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({fiscalYearEndMonth: 3, vatMethod: 'DEDUCTION', pitPeriod: 'QUARTERLY', accountingRegime: 'TT133', taxAuthority: 'Chi cục Thuế khu vực I'}));
  });
});
