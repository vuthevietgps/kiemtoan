import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { APP_ICONS } from '../../../../core/icons/app-icons';
import { PricingBasis } from '../../data-access/service-catalog.api';
import { PriceListFormComponent } from './price-list-form.component';

registerLocaleData(localeVi);

describe('PriceListFormComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideNoopAnimations(), provideNzIcons(APP_ICONS), provideNzI18n(vi_VN)],
    }),
  );

  function setup(basis: PricingBasis) {
    const fixture = TestBed.createComponent(PriceListFormComponent);
    fixture.componentRef.setInput('basis', basis);
    fixture.detectChanges();
    const submit = vi.fn();
    fixture.componentInstance.submitted.subscribe(submit);
    const form = fixture.componentInstance['form'];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    form.controls.effectiveFrom.setValue(tomorrow);
    const send = () => fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    return { fixture, form, submit, send };
  }

  it('chains each tier "from" to the previous "to" so tiers cannot overlap or leave gaps', () => {
    const { fixture, form, submit, send } = setup('DOCUMENT_COUNT');
    fixture.componentInstance['addTier']();
    fixture.componentInstance['addTier']();
    form.controls.tiers.at(0).setValue({ to: 100, unitPrice: 1000000 });
    form.controls.tiers.at(1).setValue({ to: 300, unitPrice: 2000000 });
    form.controls.tiers.at(2).setValue({ to: null, unitPrice: 3000000 });
    send();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        tiers: [
          { minValue: '0', maxValue: '100', unitPrice: '1000000' },
          { minValue: '100', maxValue: '300', unitPrice: '2000000' },
          { minValue: '300', maxValue: null, unitPrice: '3000000' },
        ],
      }),
    );
  });

  it('blocks submit when a "to" value is not greater than its "from"', () => {
    const { fixture, form, submit, send } = setup('DOCUMENT_COUNT');
    fixture.componentInstance['addTier']();
    form.controls.tiers.at(0).setValue({ to: 100, unitPrice: 1 });
    form.controls.tiers.at(1).setValue({ to: 80, unitPrice: 2 });
    send();
    expect(submit).not.toHaveBeenCalled();
  });

  it('requires "to" on every tier except the last', () => {
    const { fixture, form, submit, send } = setup('DOCUMENT_COUNT');
    fixture.componentInstance['addTier']();
    form.controls.tiers.at(0).setValue({ to: null, unitPrice: 1 });
    form.controls.tiers.at(1).setValue({ to: null, unitPrice: 2 });
    send();
    expect(submit).not.toHaveBeenCalled();
  });

  it('sends a single open-ended tier from 0 for services without tiered pricing', () => {
    const { form, submit, send } = setup('NONE');
    form.controls.tiers.at(0).controls.unitPrice.setValue(15000000);
    send();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ tiers: [{ minValue: '0', maxValue: null, unitPrice: '15000000' }] }),
    );
  });

  it('does not emit while a save is pending', () => {
    const { fixture, form, submit, send } = setup('NONE');
    form.controls.tiers.at(0).controls.unitPrice.setValue(1);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    send();
    expect(submit).not.toHaveBeenCalled();
  });
});
