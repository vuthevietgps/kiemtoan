import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { fromDateKey, toDateKey } from '../../../shared/utils/date-key';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '../../contracts/contract-labels';
import { Installment } from '../../contracts/data-access/contracts.api';
import { moneyFormatter, moneyParser } from '../../contracts/form-utils';
import type { PaymentDetail, PaymentInput } from '../data-access/payments.api';
import { PAYMENTS_TEXT } from '../payments.text';

export interface PaymentFormValue {
  input: PaymentInput;
  file: File | null;
  submit: boolean;
}

/**
 * Form lập / sửa phiếu thu (đặt trong nz-modal). Hiện số còn phải thu và tiền đang chờ duyệt (J2);
 * yêu cầu chứng từ theo hình thức (J8) được kiểm khi gửi duyệt. Chỉ phát sự kiện, không gọi API.
 */
@Component({
  selector: 'app-payment-form',
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule,
    VndPipe,
  ],
  template: `
    <form nz-form nzLayout="vertical" [formGroup]="form">
      <p class="text-muted">
        {{ text.remaining }}: <b>{{ remaining() | vnd }}</b>
        @if (+pending() > 0) {
          · {{ pending() | vnd }} {{ text.pendingHint }}
        }
      </p>
      <nz-form-item>
        <nz-form-label>{{ text.installment }}</nz-form-label>
        <nz-form-control>
          <nz-select formControlName="installmentId" nzAllowClear [nzPlaceHolder]="text.noInstallment">
            @for (i of installments(); track i.id) {
              <nz-option
                [nzValue]="i.id"
                [nzLabel]="i.name + ' — còn ' + (+i.amount - +i.paidAmount | vnd)"
              />
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label nzRequired>{{ text.amount }}</nz-form-label>
        <nz-form-control [nzErrorTip]="text.amountError">
          <nz-input-number
            formControlName="amount"
            [nzMin]="1"
            [nzFormatter]="moneyFormatter"
            [nzParser]="moneyParser"
            style="width: 100%"
          />
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label nzRequired>{{ text.paidDate }}</nz-form-label>
        <nz-form-control [nzErrorTip]="text.dateError">
          <nz-date-picker
            formControlName="paidDate"
            nzFormat="dd/MM/yyyy"
            [nzDisabledDate]="future"
            style="width: 100%"
          />
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label>{{ text.method }}</nz-form-label>
        <nz-form-control>
          <nz-select formControlName="method">
            @for (m of methods; track m.value) {
              <nz-option [nzValue]="m.value" [nzLabel]="m.label" />
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>
      @let cash = form.controls.method.value === 'CASH';
      <nz-form-item>
        <nz-form-label>{{ cash ? text.documentNumberCash : text.documentNumberTransfer }}</nz-form-label>
        <nz-form-control>
          <input nz-input formControlName="documentNumber" maxlength="100" />
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label>{{ cash ? text.fileCash : text.fileTransfer }}</nz-form-label>
        <nz-form-control>
          <input type="file" (change)="pickFile($event)" />
          @if (payment()?.documents?.length) {
            <div class="text-muted">
              {{ text.documents }}: {{ fileNames() }}
            </div>
          }
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label>{{ text.note }}</nz-form-label>
        <nz-form-control><textarea nz-input formControlName="note" rows="2"></textarea></nz-form-control>
      </nz-form-item>
      <div class="actions">
        <button nz-button type="button" (click)="cancelled.emit()">{{ text.close }}</button>
        <button nz-button type="button" [nzLoading]="busy()" (click)="emit(false)">
          {{ text.saveDraft }}
        </button>
        <button nz-button nzType="primary" type="button" [nzLoading]="busy()" (click)="emit(true)">
          {{ text.saveSubmit }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentFormComponent implements OnInit {
  readonly contractId = input.required<string>();
  readonly installments = input<Installment[]>([]);
  readonly remaining = input.required<string>();
  readonly pending = input('0');
  /** Phiếu Nháp / Trả lại đang sửa; null = lập mới. */
  readonly payment = input<PaymentDetail | null>(null);
  /** Lập phiếu từ một đợt (07-D1): chọn sẵn đợt và số còn thiếu của đợt. */
  readonly preset = input<{ installmentId: string; amount: string } | null>(null);
  readonly busy = input(false);
  readonly saved = output<PaymentFormValue>();
  readonly cancelled = output<void>();

  protected readonly text = PAYMENTS_TEXT;
  protected readonly moneyFormatter = moneyFormatter;
  protected readonly moneyParser = moneyParser;
  protected readonly file = signal<File | null>(null);
  protected readonly methods = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(
    (value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }),
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    installmentId: [null as string | null],
    amount: [0, [Validators.required, Validators.min(1)]],
    paidDate: [new Date() as Date | null, Validators.required],
    method: ['BANK_TRANSFER' as PaymentMethod],
    documentNumber: [''],
    note: [''],
  });

  ngOnInit(): void {
    const p = this.payment();
    if (p) {
      this.form.setValue({
        installmentId: p.installment?.id ?? null,
        amount: Number(p.amount),
        paidDate: fromDateKey(p.paidDate.slice(0, 10)),
        method: p.method,
        documentNumber: p.documentNumber ?? '',
        note: p.note ?? '',
      });
    } else {
      const preset = this.preset();
      this.form.patchValue({
        installmentId: preset?.installmentId ?? null,
        amount: Math.max(Number(preset?.amount ?? this.remaining()), 0),
      });
    }
  }

  /** J3: không ghi nhận ngày thu tương lai. */
  protected readonly future = (d: Date): boolean => d > new Date();

  protected fileNames(): string {
    return (this.payment()?.documents ?? []).map((d) => d.fileName).join(', ');
  }

  protected pickFile(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected emit(submit: boolean): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Object.values(this.form.controls).forEach((c) => c.updateValueAndValidity());
      return;
    }
    const v = this.form.getRawValue();
    const editing = !!this.payment();
    this.saved.emit({
      input: {
        contractId: this.contractId(),
        // Lập mới bỏ trống đợt; khi sửa gửi null để gỡ đợt đã chọn.
        installmentId: v.installmentId ?? (editing ? null : undefined),
        amount: String(v.amount),
        paidDate: toDateKey(v.paidDate!),
        method: v.method,
        documentNumber: v.documentNumber.trim() || (editing ? null : undefined),
        note: v.note.trim() || (editing ? null : undefined),
      },
      file: this.file(),
      submit,
    });
  }
}
