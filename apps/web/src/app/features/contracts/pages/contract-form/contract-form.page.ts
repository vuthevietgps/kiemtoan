import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { errorMessage } from '../../../../core/api/api';
import { AuthService } from '../../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import {
  ServiceCatalogApi,
  ServiceType,
} from '../../../service-catalog/data-access/service-catalog.api';
import { PRICING_BASIS_LABELS } from '../../../service-catalog/service-catalog.text';
import {
  ContractDetail,
  ContractInput,
  ContractsApi,
  CustomerOption,
  InstallmentDueRule,
  UserOption,
} from '../../data-access/contracts.api';
import { PriceQuoteApi } from '../../data-access/price-quote.api';
import { fromDateString, moneyFormatter, moneyParser, toDateString } from '../../form-utils';
import { CONTRACT_FORM_TEXT } from './contract-form.vi';
import { PriceSuggestions } from './price-suggestions';

type ServiceLineForm = FormGroup<{
  serviceTypeId: FormControl<string>;
  description: FormControl<string>;
  period: FormControl<string>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
  /** Giá trị tiêu chí bảng giá (số chứng từ, doanh thu…) chỉ dùng để gợi ý giá, không lưu. */
  criterionValue: FormControl<number | null>;
  assigneeId: FormControl<string | null>;
}>;

interface SuggestionHint {
  text: string;
  price: number | null;
  danger: boolean;
  canApply: boolean;
}

type InstallmentForm = FormGroup<{
  name: FormControl<string>;
  amount: FormControl<number>;
  dueDate: FormControl<Date | null>;
  /** 07 J10: hạn theo ngày cố định hoặc N ngày sau phát hành BCKT. */
  dueRule: FormControl<InstallmentDueRule>;
  dueOffsetDays: FormControl<number | null>;
}>;

@Component({
  selector: 'app-contract-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule,
    NzIconModule,
    NzTableModule,
    NzAlertModule,
    PageHeaderComponent,
    VndPipe,
  ],
  templateUrl: './contract-form.page.html',
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0 16px;
    }
    .totals {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      justify-content: flex-end;
      font-size: 15px;
    }
    .totals b {
      color: #0f2a4a;
    }
    nz-input-number,
    nz-date-picker,
    nz-select {
      width: 100%;
    }
    .due-rule {
      display: flex;
      gap: 6px;
      nz-input-number {
        width: 90px;
        flex: none;
      }
    }
    .hint {
      margin-top: 2px;
      color: rgba(0, 0, 0, 0.45);
      font-size: 12px;
    }
    h3 {
      margin: 0 0 12px;
      font-size: 16px;
    }
    .price-hint {
      margin-top: 2px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.55);
    }
    .price-hint.danger {
      color: #cf1322;
    }
    .price-hint b {
      margin-left: 4px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractFormPage implements OnInit {
  /** Có id (route /contracts/:id/edit) → sửa hợp đồng. */
  readonly id = input<string>();

  private readonly api = inject(ContractsApi);
  private readonly catalogApi = inject(ServiceCatalogApi);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly quoteApi = inject(PriceQuoteApi);
  private readonly destroyRef = inject(DestroyRef);
  /** Báo giá 03 cần quyền tài chính; thiếu quyền thì giữ cách điền giá chuẩn cũ. */
  private readonly canQuote = inject(AuthService).can('finance:view');

  protected readonly suggestions = new PriceSuggestions<ServiceLineForm>(
    {
      quote: (r) => this.quoteApi.quote(r.serviceTypeId, { date: r.date, value: r.value }),
      currentPrice: (line) => line.controls.unitPrice.value,
      applyPrice: (line, price) => line.controls.unitPrice.setValue(price),
    },
    this.destroyRef,
  );

  protected readonly moneyFormatter = moneyFormatter;
  protected readonly moneyParser = moneyParser;
  protected readonly text = CONTRACT_FORM_TEXT;

  protected readonly customers = signal<CustomerOption[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly serviceTypes = signal<ServiceType[]>([]);
  protected readonly saving = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly locked = signal(false);

  protected readonly form = this.fb.group({
    customerId: ['', Validators.required],
    ownerId: this.fb.control<string | null>(null),
    signedDate: this.fb.control<Date | null>(null),
    startDate: this.fb.control<Date | null>(new Date(), Validators.required),
    endDate: this.fb.control<Date | null>(null),
    vatRate: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
    note: [''],
    salesOwnerId: this.fb.control<string | null>(null),
    referrerName: [''],
    referrerPhone: [''],
    referrerNote: [''],
    services: this.fb.array<ServiceLineForm>([]),
    installments: this.fb.array<InstallmentForm>([]),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  protected readonly totals = computed(() => {
    const v = this.value();
    const subtotal = (v.services ?? []).reduce(
      (sum, s) => sum + (s.quantity ?? 0) * (s.unitPrice ?? 0),
      0,
    );
    const vat = Math.round((subtotal * (v.vatRate ?? 0)) / 100);
    const installments = (v.installments ?? []).reduce((sum, i) => sum + (i.amount ?? 0), 0);
    return { subtotal, vat, total: subtotal + vat, installments };
  });

  get services(): FormArray<ServiceLineForm> {
    return this.form.controls.services;
  }

  get installments(): FormArray<InstallmentForm> {
    return this.form.controls.installments;
  }

  ngOnInit(): void {
    this.form.controls.startDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshAllSuggestions());
    this.api.userOptions().subscribe({ next: (u) => this.users.set(u) });
    this.catalogApi.list().subscribe({
      next: (s) => {
        this.serviceTypes.set(s.filter((x) => x.isActive));
        this.refreshAllSuggestions();
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
    this.api.customerOptions().subscribe({
      next: (c) => this.customers.update((cur) => mergeById(c, cur)),
      error: () => this.loadError.set(this.text.customersLoadError),
    });
    const id = this.id();
    if (id) {
      this.api.get(id).subscribe({
        next: (c) => {
          this.fill(c);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loadError.set(errorMessage(err));
          this.loading.set(false);
        },
      });
    } else {
      this.addService();
      this.loading.set(false);
    }
  }

  protected addService(): void {
    this.services.push(
      this.fb.group({
        serviceTypeId: ['', Validators.required],
        description: [''],
        period: [''],
        quantity: [1, [Validators.required, Validators.min(1)]],
        unitPrice: [0, [Validators.required, Validators.min(0)]],
        criterionValue: this.fb.control<number | null>(null, Validators.min(0)),
        assigneeId: this.fb.control<string | null>(null),
      }),
    );
  }

  protected removeService(index: number): void {
    this.suggestions.forget(this.services.at(index));
    this.services.removeAt(index);
  }

  /** J10: chỉ chọn "sau phát hành BCKT" khi HĐ có dịch vụ phát hành báo cáo kiểm toán. */
  protected hasAuditLine(): boolean {
    return this.services.controls.some(
      (line) => this.serviceTypeOf(line)?.issuesAuditReport,
    );
  }

  protected addInstallment(): void {
    const remaining = this.totals().total - this.totals().installments;
    this.installments.push(
      this.fb.group({
        name: [this.text.installmentName(this.installments.length + 1), Validators.required],
        amount: [Math.max(remaining, 0), [Validators.required, Validators.min(0)]],
        dueDate: this.fb.control<Date | null>(null, Validators.required),
        dueRule: this.fb.control<InstallmentDueRule>('FIXED_DATE'),
        dueOffsetDays: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(365)]),
      }),
    );
  }

  /** Chọn dịch vụ → gợi ý giá theo bảng giá (04-E); thiếu quyền báo giá thì điền giá chuẩn nếu đơn giá trống. */
  protected onServiceChange(line: ServiceLineForm): void {
    line.controls.criterionValue.setValue(null);
    if (this.canQuote) {
      this.refreshSuggestion(line);
      return;
    }
    const type = this.serviceTypeOf(line);
    if (type?.defaultPrice !== undefined && !line.controls.unitPrice.value) {
      line.controls.unitPrice.setValue(Number(type.defaultPrice));
    }
  }

  /** Gọi lại báo giá cho dòng theo dịch vụ, ngày bắt đầu HĐ và giá trị tiêu chí hiện tại. */
  protected refreshSuggestion(line: ServiceLineForm): void {
    if (!this.canQuote || this.locked()) return;
    const type = this.serviceTypeOf(line);
    this.suggestions.request(
      line,
      type
        ? {
            serviceTypeId: type.id,
            date: toDateString(this.form.controls.startDate.value),
            value: line.controls.criterionValue.value,
            needsValue: type.pricingBasis !== 'NONE',
          }
        : null,
    );
  }

  /** Nhãn ô tiêu chí ("Doanh thu năm (đồng)"); null khi dịch vụ chỉ có một mức giá. */
  protected criterionLabel(line: ServiceLineForm): string | null {
    const type = this.serviceTypeOf(line);
    if (!this.canQuote || !type || type.pricingBasis === 'NONE') return null;
    const label = PRICING_BASIS_LABELS[type.pricingBasis];
    return type.pricingUnit ? `${label} (${type.pricingUnit})` : label;
  }

  protected suggestionHint(line: ServiceLineForm): SuggestionHint | null {
    const s = this.suggestions.get(line);
    if (!s) return null;
    switch (s.state) {
      case 'loading':
        return { text: this.text.suggestLoading, price: null, danger: false, canApply: false };
      case 'needs-value':
        return { text: this.text.suggestNeedsValue, price: null, danger: false, canApply: false };
      case 'error':
        return { text: s.message, price: null, danger: true, canApply: false };
      case 'ready': {
        const text = !s.fallback
          ? this.text.suggestFromPriceList
          : s.reason === 'NO_TIER'
            ? this.text.suggestDefaultNoTier
            : this.text.suggestDefaultNoList;
        const canApply = s.unitPrice !== line.controls.unitPrice.value;
        return { text, price: s.unitPrice, danger: false, canApply };
      }
    }
  }

  private refreshAllSuggestions(): void {
    for (const line of this.services.controls) this.refreshSuggestion(line);
  }

  private serviceTypeOf(line: ServiceLineForm): ServiceType | undefined {
    return this.serviceTypes().find((s) => s.id === line.controls.serviceTypeId.value);
  }

  protected save(): void {
    if (this.loading() || this.loadError() || this.locked() || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.message.warning(this.text.requiredFields);
      return;
    }
    const v = this.form.getRawValue();
    const input: ContractInput = {
      customerId: v.customerId,
      ownerId: v.ownerId,
      signedDate: toDateString(v.signedDate),
      startDate: toDateString(v.startDate)!,
      endDate: toDateString(v.endDate),
      vatRate: v.vatRate,
      note: v.note.trim() || null,
      salesOwnerId: v.salesOwnerId,
      referrerName: v.referrerName.trim() || null,
      referrerPhone: v.referrerPhone.trim() || null,
      referrerNote: v.referrerNote.trim() || null,
      services: v.services.map((s) => ({
        serviceTypeId: s.serviceTypeId,
        description: s.description || undefined,
        period: s.period || undefined,
        quantity: s.quantity,
        unitPrice: String(s.unitPrice),
        assigneeId: s.assigneeId || undefined,
      })),
      installments: v.installments.map((i) => ({
        name: i.name,
        amount: String(i.amount),
        dueDate: toDateString(i.dueDate)!,
        dueRule: i.dueRule,
        dueOffsetDays: i.dueRule === 'AFTER_REPORT_ISSUE' ? i.dueOffsetDays : null,
      })),
    };
    const id = this.id();
    this.saving.set(true);
    (id ? this.api.update(id, input) : this.api.create(input)).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.message.success(id ? this.text.saved : this.text.created(c.code));
        void this.router.navigate(['/contracts', c.id]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }

  private fill(c: ContractDetail): void {
    this.locked.set(!['DRAFT', 'PENDING_APPROVAL'].includes(c.status));
    this.customers.update((cur) =>
      mergeById(cur, [{ id: c.customer.id, name: c.customer.name, taxCode: c.customer.taxCode }]),
    );
    this.form.patchValue({
      customerId: c.customerId,
      ownerId: c.ownerId,
      signedDate: fromDateString(c.signedDate),
      startDate: fromDateString(c.startDate),
      endDate: fromDateString(c.endDate),
      vatRate: Number(c.vatRate),
      note: c.note ?? '',
      salesOwnerId: c.salesOwnerId,
      referrerName: c.referrerName ?? '',
      referrerPhone: c.referrerPhone ?? '',
      referrerNote: c.referrerNote ?? '',
    });
    this.services.clear();
    for (const s of c.services) {
      this.addService();
      this.services.at(-1).patchValue({
        serviceTypeId: s.serviceTypeId,
        description: s.description ?? '',
        period: s.period ?? '',
        quantity: s.quantity,
        unitPrice: Number(s.unitPrice),
        assigneeId: s.assigneeId,
      });
    }
    // Chỉ hiện gợi ý để so sánh; đơn giá đã lưu khác 0 nên không bị tự ghi đè.
    this.refreshAllSuggestions();
    this.installments.clear();
    for (const i of c.installments) {
      this.addInstallment();
      this.installments.at(-1).patchValue({
        name: i.name,
        amount: Number(i.amount),
        dueDate: fromDateString(i.dueDate),
        dueRule: i.dueRule,
        dueOffsetDays: i.dueOffsetDays,
      });
    }
  }
}

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) map.set(x.id, x);
  return [...map.values()];
}
