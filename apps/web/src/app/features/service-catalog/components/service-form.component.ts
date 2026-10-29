import { ChangeDetectionStrategy, Component, inject, input, OnInit, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { BILLING_CYCLE_OPTIONS, BillingCycle } from '../../contracts/contract-labels';
import { moneyFormatter, moneyParser } from '../../contracts/form-utils';
import { PricingBasis, ServiceType, ServiceTypeInput } from '../data-access/service-catalog.api';
import { PRICING_BASIS_OPTIONS, SERVICE_CATALOG_TEXT } from '../service-catalog.text';

/** Thêm / sửa dịch vụ kèm tiêu chí bảng giá. Quy trình sửa ở màn hình Quy trình mẫu. Chỉ nhận input và phát output. */
@Component({
  selector: 'app-service-form',
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzButtonModule,
  ],
  templateUrl: './service-form.component.html',
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 16px; }
    nz-input-number, nz-select { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFormComponent implements OnInit {
  /** Có giá trị → sửa; null → thêm mới. */
  readonly service = input<ServiceType | null>(null);
  readonly saving = input(false);
  readonly submitted = output<ServiceTypeInput>();
  readonly cancelled = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly text = SERVICE_CATALOG_TEXT;
  protected readonly cycleOptions = BILLING_CYCLE_OPTIONS;
  protected readonly basisOptions = PRICING_BASIS_OPTIONS;
  protected readonly moneyFormatter = moneyFormatter;
  protected readonly moneyParser = moneyParser;

  protected readonly form = this.fb.group({
    code: ['', Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    cycle: ['MONTHLY' as BillingCycle, Validators.required],
    defaultPrice: [0, [Validators.min(0)]],
    pricingBasis: ['NONE' as PricingBasis, Validators.required],
    pricingUnit: ['', Validators.maxLength(50)],
    description: [''],
    isActive: [true],
    issuesAuditReport: [false],
  });

  ngOnInit(): void {
    const s = this.service();
    if (!s) return;
    this.form.patchValue({
      code: s.code,
      name: s.name,
      cycle: s.cycle,
      defaultPrice: Number(s.defaultPrice ?? 0),
      pricingBasis: s.pricingBasis,
      pricingUnit: s.pricingUnit ?? '',
      description: s.description ?? '',
      isActive: s.isActive,
      issuesAuditReport: s.issuesAuditReport,
    });
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitted.emit({
      ...v,
      defaultPrice: String(v.defaultPrice),
      pricingUnit: v.pricingUnit.trim() || null,
    });
  }
}
