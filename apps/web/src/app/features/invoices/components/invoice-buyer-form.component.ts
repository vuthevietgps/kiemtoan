import { ChangeDetectionStrategy, Component, inject, input, OnInit, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import type { InvoiceBuyer } from '../data-access/invoices.api';
import { INVOICES_TEXT } from '../invoices.text';

/** Sửa người mua trên đề nghị chưa xuất (08 K7). Chỉ phát sự kiện. */
@Component({
  selector: 'app-invoice-buyer-form',
  imports: [ReactiveFormsModule, NzButtonModule, NzFormModule, NzInputModule],
  template: `
    <form nz-form nzLayout="vertical" [formGroup]="form">
      <nz-form-item>
        <nz-form-label nzRequired>{{ text.buyer }}</nz-form-label>
        <nz-form-control [nzErrorTip]="text.required">
          <input nz-input formControlName="buyerName" maxlength="300" />
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label>{{ text.taxCode }}</nz-form-label>
        <nz-form-control
          ><input nz-input formControlName="buyerTaxCode" maxlength="20"
        /></nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label>{{ text.address }}</nz-form-label>
        <nz-form-control
          ><input nz-input formControlName="buyerAddress" maxlength="500"
        /></nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label>{{ text.email }}</nz-form-label>
        <nz-form-control nzErrorTip="Email không hợp lệ">
          <input nz-input formControlName="buyerEmail" maxlength="200" />
        </nz-form-control>
      </nz-form-item>
      <div class="actions">
        <button nz-button type="button" (click)="cancelled.emit()">{{ text.close }}</button>
        <button nz-button nzType="primary" type="button" [nzLoading]="busy()" (click)="submit()">
          {{ text.save }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceBuyerFormComponent implements OnInit {
  readonly buyer = input<Partial<InvoiceBuyer> | null>(null);
  readonly busy = input(false);
  readonly saved = output<InvoiceBuyer>();
  readonly cancelled = output<void>();

  protected readonly text = INVOICES_TEXT;
  protected readonly form = inject(NonNullableFormBuilder).group({
    buyerName: ['', Validators.required],
    buyerTaxCode: [''],
    buyerAddress: [''],
    buyerEmail: ['', Validators.email],
  });

  ngOnInit(): void {
    const b = this.buyer();
    this.form.patchValue({
      buyerName: b?.buyerName ?? '',
      buyerTaxCode: b?.buyerTaxCode ?? '',
      buyerAddress: b?.buyerAddress ?? '',
      buyerEmail: b?.buyerEmail ?? '',
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Object.values(this.form.controls).forEach((c) => c.updateValueAndValidity());
      return;
    }
    const v = this.form.getRawValue();
    this.saved.emit({
      buyerName: v.buyerName.trim(),
      buyerTaxCode: v.buyerTaxCode.trim() || null,
      buyerAddress: v.buyerAddress.trim() || null,
      buyerEmail: v.buyerEmail.trim() || null,
    });
  }
}
