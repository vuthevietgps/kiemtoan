import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { fromDateString, moneyFormatter, moneyParser, toDateString } from '../../../contracts/form-utils';
import { PriceList, PriceListInput, PricingBasis } from '../../data-access/service-catalog.api';
import { PRICING_BASIS_LABELS, SERVICE_CATALOG_TEXT } from '../../service-catalog.text';

type TierForm = FormGroup<{
  to: FormControl<number | null>;
  unitPrice: FormControl<number | null>;
}>;

/**
 * Form bảng giá. "Từ" của mỗi bậc lấy từ "đến" của bậc trước nên không thể hở/chồng lấn;
 * backend vẫn kiểm tra lại. Component chỉ nhận input và phát output, không gọi API.
 */
@Component({
  selector: 'app-price-list-form',
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzDatePickerModule,
    NzButtonModule,
    NzIconModule,
  ],
  templateUrl: './price-list-form.component.html',
  styles: `
    .tier { display: grid; grid-template-columns: 1fr 1fr 1fr 40px; gap: 8px; align-items: start; margin-bottom: 8px; }
    .from { padding-top: 5px; }
    nz-input-number, nz-date-picker { width: 100%; }
    .error { color: #ff4d4f; font-size: 12px; }
    @media (max-width: 575px) { .tier { grid-template-columns: 1fr 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceListFormComponent implements OnInit {
  readonly basis = input.required<PricingBasis>();
  readonly unit = input<string | null>(null);
  /** Có giá trị → sửa bảng giá sắp áp dụng; null → tạo mới. */
  readonly priceList = input<PriceList | null>(null);
  readonly saving = input(false);
  readonly submitted = output<PriceListInput>();
  readonly cancelled = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly text = SERVICE_CATALOG_TEXT;
  protected readonly basisLabels = PRICING_BASIS_LABELS;
  protected readonly moneyFormatter = moneyFormatter;
  protected readonly moneyParser = moneyParser;

  protected readonly form = this.fb.group({
    effectiveFrom: new FormControl<Date | null>(null, Validators.required),
    note: [''],
    firstFrom: [0, [Validators.required, Validators.min(0)]],
    tiers: this.fb.array<TierForm>([]),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** "Từ" của từng bậc: bậc đầu nhập tay, các bậc sau bằng "đến" của bậc trước. */
  protected readonly froms = computed(() => {
    const value = this.value();
    const tiers = value.tiers ?? [];
    return tiers.map((_, i) => (i === 0 ? (value.firstFrom ?? 0) : (tiers[i - 1].to ?? null)));
  });

  /** Lỗi theo bậc: "đến" bắt buộc (trừ bậc cuối) và phải lớn hơn "từ". */
  protected readonly tierErrors = computed(() => {
    const tiers = this.value().tiers ?? [];
    const froms = this.froms();
    return tiers.map((tier, i) => {
      const last = i === tiers.length - 1;
      if (tier.to === null || tier.to === undefined) return last ? '' : this.text.toError;
      const from = froms[i];
      return from !== null && tier.to <= from ? this.text.toError : '';
    });
  });

  protected get tiers() {
    return this.form.controls.tiers;
  }

  protected get flat(): boolean {
    return this.basis() === 'NONE';
  }

  ngOnInit(): void {
    const list = this.priceList();
    if (!list) {
      this.addTier();
      return;
    }
    this.form.patchValue({
      effectiveFrom: fromDateString(list.effectiveFrom),
      note: list.note ?? '',
      firstFrom: Number(list.tiers[0]?.minValue ?? 0),
    });
    for (const tier of list.tiers) {
      this.addTier(tier.maxValue === null ? null : Number(tier.maxValue), Number(tier.unitPrice));
    }
  }

  protected addTier(to: number | null = null, unitPrice: number | null = null): void {
    this.tiers.push(
      this.fb.group({
        to: new FormControl<number | null>(to),
        unitPrice: new FormControl<number | null>(unitPrice, [Validators.required, Validators.min(0)]),
      }),
    );
  }

  protected disabledDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid || this.tierErrors().some(Boolean)) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const froms = this.froms();
    this.submitted.emit({
      effectiveFrom: toDateString(value.effectiveFrom) ?? '',
      note: value.note.trim() || null,
      tiers: value.tiers.map((tier, i) => ({
        minValue: this.flat ? '0' : String(froms[i] ?? 0),
        maxValue: this.flat || tier.to === null ? null : String(tier.to),
        unitPrice: String(tier.unitPrice ?? 0),
      })),
    });
  }
}
