import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { moneyFormatter, moneyParser } from '../../contracts/form-utils';
import type { InvoiceRequestInput } from '../data-access/invoices.api';
import { INVOICES_TEXT } from '../invoices.text';

/** Đợt có thể đề nghị xuất (chưa có đề nghị / hoá đơn hiệu lực). */
export interface InvoiceableInstallment {
  id: string;
  name: string;
  dueDate: string;
  amount: string;
}

/**
 * Đề nghị xuất hoá đơn cho một HĐ (08 K2, K7): theo đợt thanh toán (tiền = tổng đợt, gồm VAT) hoặc
 * theo giá trị trước VAT (mặc định phần chưa xuất); người mua lấy sẵn từ khách hàng. Chỉ phát sự kiện.
 */
@Component({
  selector: 'app-invoice-request-form',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    VndPipe,
  ],
  template: `
    <form nz-form nzLayout="vertical" [formGroup]="form">
      <nz-radio-group
        class="mode"
        [ngModel]="mode()"
        [ngModelOptions]="{ standalone: true }"
        (ngModelChange)="mode.set($event)"
      >
        <label nz-radio-button nzValue="installments">{{ text.byInstallments }}</label>
        <label nz-radio-button nzValue="value">{{ text.byValue }}</label>
      </nz-radio-group>

      @if (mode() === 'installments') {
        <p class="label">{{ text.pickInstallments }}</p>
        @for (i of installments(); track i.id) {
          <label
            nz-checkbox
            class="row"
            [nzChecked]="picked().includes(i.id)"
            (nzCheckedChange)="toggle(i.id, $event)"
          >
            {{ i.name }} · {{ i.dueDate | date: 'dd/MM/yyyy' }} — <b>{{ i.amount | vnd }}</b>
          </label>
        } @empty {
          <p class="muted">{{ text.noInstallments }}</p>
        }
      } @else {
        <p class="muted">
          {{ text.remaining }}: <b>{{ remaining() | vnd }}</b> · {{ text.vatNote }}
        </p>
        <nz-form-item>
          <nz-form-label nzRequired>{{ text.value }}</nz-form-label>
          <nz-form-control nzErrorTip="Giá trị phải lớn hơn 0">
            <nz-input-number
              formControlName="subtotal"
              [nzMin]="1"
              [nzFormatter]="moneyFormatter"
              [nzParser]="moneyParser"
            />
          </nz-form-control>
        </nz-form-item>
      }

      <nz-form-item>
        <nz-form-label nzRequired>{{ text.buyer }}</nz-form-label>
        <nz-form-control [nzErrorTip]="text.required">
          <input nz-input formControlName="buyerName" maxlength="300" />
        </nz-form-control>
      </nz-form-item>
      <div class="grid">
        <nz-form-item>
          <nz-form-label>{{ text.taxCode }}</nz-form-label>
          <nz-form-control
            ><input nz-input formControlName="buyerTaxCode" maxlength="20"
          /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label>{{ text.email }}</nz-form-label>
          <nz-form-control nzErrorTip="Email không hợp lệ">
            <input nz-input formControlName="buyerEmail" maxlength="200" />
          </nz-form-control>
        </nz-form-item>
      </div>
      <nz-form-item>
        <nz-form-label>{{ text.address }}</nz-form-label>
        <nz-form-control
          ><input nz-input formControlName="buyerAddress" maxlength="500"
        /></nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label>{{ text.note }}</nz-form-label>
        <nz-form-control>
          <textarea nz-input rows="2" formControlName="note" maxlength="1000"></textarea>
        </nz-form-control>
      </nz-form-item>
      <div class="actions">
        <button nz-button type="button" (click)="cancelled.emit()">{{ text.close }}</button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="mode() === 'installments' && !picked().length"
          [nzLoading]="busy()"
          (click)="submit()"
        >
          {{ text.send }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .mode {
      margin-bottom: 12px;
    }
    .label {
      margin-bottom: 6px;
      font-weight: 500;
    }
    .row {
      display: flex;
      margin: 0 0 6px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0 12px;
    }
    nz-input-number {
      width: 100%;
    }
    .muted {
      color: rgba(0, 0, 0, 0.5);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceRequestFormComponent implements OnInit {
  readonly contractId = input.required<string>();
  readonly installments = input<InvoiceableInstallment[]>([]);
  /** Giá trị trước VAT chưa xuất hoá đơn. */
  readonly remaining = input.required<number>();
  readonly customer = input<{
    name: string;
    taxCode: string;
    address: string | null;
    contactEmail?: string | null;
  } | null>(null);
  readonly busy = input(false);
  readonly saved = output<InvoiceRequestInput>();
  readonly cancelled = output<void>();

  protected readonly text = INVOICES_TEXT;
  protected readonly moneyFormatter = moneyFormatter;
  protected readonly moneyParser = moneyParser;
  protected readonly mode = signal<'installments' | 'value'>('installments');
  protected readonly picked = signal<string[]>([]);
  protected readonly form = inject(NonNullableFormBuilder).group({
    subtotal: [0, [Validators.required, Validators.min(1)]],
    buyerName: ['', Validators.required],
    buyerTaxCode: [''],
    buyerAddress: [''],
    buyerEmail: ['', Validators.email],
    note: [''],
  });

  ngOnInit(): void {
    const c = this.customer();
    this.form.patchValue({
      subtotal: Math.max(this.remaining(), 0),
      buyerName: c?.name ?? '',
      buyerTaxCode: c?.taxCode ?? '',
      buyerAddress: c?.address ?? '',
      buyerEmail: c?.contactEmail ?? '',
    });
    if (!this.installments().length) this.mode.set('value');
    else this.picked.set([this.installments()[0].id]);
  }

  protected toggle(id: string, checked: boolean): void {
    this.picked.update((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  protected submit(): void {
    const byValue = this.mode() === 'value';
    if (!byValue) this.form.controls.subtotal.disable();
    const invalid = this.form.invalid;
    this.form.controls.subtotal.enable();
    if (invalid) {
      this.form.markAllAsTouched();
      Object.values(this.form.controls).forEach((c) => c.updateValueAndValidity());
      return;
    }
    const v = this.form.getRawValue();
    this.saved.emit({
      contractId: this.contractId(),
      ...(byValue ? { subtotal: String(v.subtotal) } : { installmentIds: this.picked() }),
      buyerName: v.buyerName.trim(),
      buyerTaxCode: v.buyerTaxCode.trim() || undefined,
      buyerAddress: v.buyerAddress.trim() || null,
      buyerEmail: v.buyerEmail.trim() || null,
      note: v.note.trim() || undefined,
    });
  }
}
