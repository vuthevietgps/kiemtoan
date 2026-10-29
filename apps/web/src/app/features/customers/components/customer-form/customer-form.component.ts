import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  ACCOUNTING_REGIME_OPTIONS,
  AccountingRegime,
  CUSTOMER_STATUS_OPTIONS,
  CustomerStatus,
  FISCAL_MONTH_OPTIONS,
  PIT_PERIOD_OPTIONS,
  PitPeriod,
  TAX_PERIOD_OPTIONS,
  TaxPeriod,
  VAT_METHOD_OPTIONS,
  VatMethod,
} from '../../customer-labels';
import { Customer, CustomerInput, UserOption } from '../../data-access/customers.api';

import { CUSTOMERS_TEXT } from '../../customers.text';

const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/;

/** Form thêm / sửa khách hàng. Không truyền `customer` = thêm mới. */
@Component({
  selector: 'app-customer-form',
  imports: [ReactiveFormsModule, NzDividerModule, NzFormModule, NzGridModule, NzInputModule, NzSelectModule, NzButtonModule],
  templateUrl: './customer-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFormComponent {
  readonly customer = input<Customer | null>(null);
  readonly submitted = output<CustomerInput>();
  readonly users = input<UserOption[]>([]);
  readonly saving = input(false);
  protected readonly text = CUSTOMERS_TEXT;
  readonly cancelled = output<void>();

  protected readonly statusOptions = CUSTOMER_STATUS_OPTIONS;
  protected readonly taxPeriodOptions = TAX_PERIOD_OPTIONS;
  protected readonly vatMethodOptions = VAT_METHOD_OPTIONS;
  protected readonly pitPeriodOptions = PIT_PERIOD_OPTIONS;
  protected readonly regimeOptions = ACCOUNTING_REGIME_OPTIONS;
  protected readonly fiscalMonthOptions = FISCAL_MONTH_OPTIONS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    taxCode: ['', [Validators.required, Validators.pattern(TAX_CODE_PATTERN)]],
    address: ['', Validators.maxLength(1000)],
    legalRep: ['', Validators.maxLength(200)],
    businessType: ['', Validators.maxLength(100)],
    taxPeriod: ['MONTHLY' as TaxPeriod],
    fiscalYearEndMonth: [12],
    vatMethod: [null as VatMethod | null],
    pitPeriod: [null as PitPeriod | null],
    accountingRegime: [null as AccountingRegime | null],
    taxAuthority: ['', Validators.maxLength(200)],
    status: ['ACTIVE' as CustomerStatus],
    contactName: ['', Validators.maxLength(200)],
    contactPhone: ['', Validators.maxLength(30)],
    contactEmail: ['', Validators.email],
    ownerId: [''],
    note: ['', Validators.maxLength(2000)],
  });

  constructor() {
    effect(() => {
      const c = this.customer();
      if (!c) { this.form.reset(); return; }
      this.form.reset({
        name: c.name,
        taxCode: c.taxCode,
        address: c.address ?? '',
        legalRep: c.legalRep ?? '',
        businessType: c.businessType ?? '',
        taxPeriod: c.taxPeriod,
        fiscalYearEndMonth: c.fiscalYearEndMonth,
        vatMethod: c.vatMethod,
        pitPeriod: c.pitPeriod,
        accountingRegime: c.accountingRegime,
        taxAuthority: c.taxAuthority ?? '',
        status: c.status,
        contactName: c.contactName ?? '',
        contactPhone: c.contactPhone ?? '',
        contactEmail: c.contactEmail ?? '',
        ownerId: c.ownerId ?? '',
        note: c.note ?? '',
      });
    });
  }

  protected submit(): void {
    if (this.saving()) return;
    this.form.controls.name.setValue(this.form.controls.name.value.trim());
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity();
      });
      return;
    }
    const raw = this.form.getRawValue();
    // Ô bỏ trống gửi null để xoá giá trị cũ.
    const input: CustomerInput = {
      ...raw,
      address: raw.address || null,
      legalRep: raw.legalRep || null,
      businessType: raw.businessType || null,
      taxAuthority: raw.taxAuthority || null,
      contactName: raw.contactName || null,
      contactPhone: raw.contactPhone || null,
      contactEmail: raw.contactEmail || null,
      note: raw.note || null,
      ownerId: raw.ownerId || null,
    };
    if (this.customer() && !input.ownerId) { this.form.controls.ownerId.setErrors({required: true}); return; }
    this.submitted.emit(input);
  }
}
