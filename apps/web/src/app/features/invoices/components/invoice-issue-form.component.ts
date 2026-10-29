import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { errorMessage } from '../../../core/api/api';
import { toDateString } from '../../contracts/form-utils';
import { InvoiceItem, InvoicesApi } from '../data-access/invoices.api';

/** Form "Phát hành hoá đơn": số, ký hiệu, ngày phát hành. */
@Component({
  selector: 'app-invoice-issue-form',
  imports: [ReactiveFormsModule, NzFormModule, NzInputModule, NzDatePickerModule, NzButtonModule],
  template: `
    <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
      <nz-form-item>
        <nz-form-label nzRequired>Ký hiệu</nz-form-label>
        <nz-form-control nzErrorTip="Vui lòng nhập ký hiệu">
          <input nz-input formControlName="symbol" placeholder="1C25TAA" />
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label nzRequired>Số hoá đơn</nz-form-label>
        <nz-form-control nzErrorTip="Vui lòng nhập số hoá đơn">
          <input nz-input formControlName="number" placeholder="0000123" />
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label nzRequired>Ngày phát hành</nz-form-label>
        <nz-form-control nzErrorTip="Vui lòng chọn ngày">
          <nz-date-picker formControlName="issueDate" nzFormat="dd/MM/yyyy" style="width: 100%" />
        </nz-form-control>
      </nz-form-item>
      <div class="text-right">
        <button nz-button type="button" (click)="cancelled.emit()">Huỷ</button>
        <button nz-button nzType="primary" type="submit" [nzLoading]="saving()" style="margin-left: 8px">
          Phát hành
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceIssueFormComponent {
  readonly invoiceId = input.required<string>();
  readonly saved = output<InvoiceItem>();
  readonly cancelled = output<void>();

  private readonly api = inject(InvoicesApi);
  private readonly message = inject(NzMessageService);

  protected readonly saving = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    symbol: ['', Validators.required],
    number: ['', Validators.required],
    issueDate: [new Date() as Date | null, Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .issue(this.invoiceId(), {
        symbol: v.symbol.trim(),
        number: v.number.trim(),
        issueDate: toDateString(v.issueDate)!,
      })
      .subscribe({
        next: (inv) => {
          this.saving.set(false);
          this.message.success('Đã phát hành hoá đơn');
          this.saved.emit(inv);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.message.error(errorMessage(err));
        },
      });
  }
}
