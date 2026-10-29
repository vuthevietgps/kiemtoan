import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { errorMessage } from '../../../core/api/api';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { moneyFormatter, moneyParser } from '../../contracts/form-utils';
import { InvoiceItem, InvoicesApi } from '../data-access/invoices.api';

/** Form "Đề nghị xuất hoá đơn" cho một hợp đồng; mặc định phần giá trị chưa xuất hoá đơn. */
@Component({
  selector: 'app-invoice-request-form',
  imports: [ReactiveFormsModule, NzFormModule, NzInputModule, NzInputNumberModule, NzButtonModule, VndPipe],
  template: `
    <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
      <p class="text-muted">
        Giá trị chưa xuất hoá đơn (trước VAT): <b>{{ remaining() | vnd }}</b>. VAT tính theo thuế suất của hợp đồng.
      </p>
      <nz-form-item>
        <nz-form-label nzRequired>Giá trị trước VAT</nz-form-label>
        <nz-form-control nzErrorTip="Giá trị phải lớn hơn 0">
          <nz-input-number
            formControlName="subtotal"
            [nzMin]="1"
            [nzFormatter]="moneyFormatter"
            [nzParser]="moneyParser"
            style="width: 100%"
          />
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label>Ghi chú</nz-form-label>
        <nz-form-control><textarea nz-input formControlName="note" rows="2"></textarea></nz-form-control>
      </nz-form-item>
      <div class="text-right">
        <button nz-button type="button" (click)="cancelled.emit()">Huỷ</button>
        <button nz-button nzType="primary" type="submit" [nzLoading]="saving()" style="margin-left: 8px">
          Gửi đề nghị
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceRequestFormComponent implements OnInit {
  readonly contractId = input.required<string>();
  /** Giá trị trước VAT chưa xuất hoá đơn. */
  readonly remaining = input.required<number>();
  readonly saved = output<InvoiceItem>();
  readonly cancelled = output<void>();

  private readonly api = inject(InvoicesApi);
  private readonly message = inject(NzMessageService);

  protected readonly moneyFormatter = moneyFormatter;
  protected readonly moneyParser = moneyParser;
  protected readonly saving = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    subtotal: [0, [Validators.required, Validators.min(1)]],
    note: [''],
  });

  ngOnInit(): void {
    this.form.controls.subtotal.setValue(Math.max(this.remaining(), 0));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api.request(this.contractId(), String(v.subtotal), v.note || null).subscribe({
      next: (inv) => {
        this.saving.set(false);
        this.message.success('Đã gửi đề nghị xuất hoá đơn');
        this.saved.emit(inv);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }
}
