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
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { toDateKey } from '../../../shared/utils/date-key';
import { moneyFormatter, moneyParser } from '../../contracts/form-utils';
import type { InvoiceDetail, InvoiceRecordInput } from '../data-access/invoices.api';
import { INVOICES_TEXT, RecordMode } from '../invoices.text';

/**
 * Biểu mẫu ghi nhận hoá đơn đã xuất trên cổng EasyInvoice (08 K5) — dùng cho ghi nhận xuất, hoá đơn
 * điều chỉnh (tăng/giảm, số tiền, lý do) và hoá đơn thay thế (giá trị mới, lý do, người mua). PDF bắt buộc.
 * Chỉ phát sự kiện, không gọi API.
 */
@Component({
  selector: 'app-invoice-record-form',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
  ],
  template: `
    <form nz-form nzLayout="vertical" [formGroup]="form">
      <div class="grid">
        <nz-form-item>
          <nz-form-label nzRequired>{{ text.templateCode }}</nz-form-label>
          <nz-form-control [nzErrorTip]="text.required">
            <input nz-input formControlName="templateCode" placeholder="1" maxlength="10" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired>{{ text.symbol }}</nz-form-label>
          <nz-form-control [nzErrorTip]="text.required">
            <input nz-input formControlName="symbol" placeholder="C25TAA" maxlength="20" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired>{{ text.number }}</nz-form-label>
          <nz-form-control [nzErrorTip]="text.required">
            <input nz-input formControlName="number" placeholder="00000123" maxlength="20" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired>{{ text.issueDate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="text.required">
            <nz-date-picker
              formControlName="issueDate"
              nzFormat="dd/MM/yyyy"
              [nzDisabledDate]="future"
              [nzAllowClear]="false"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label>{{ text.lookupCode }}</nz-form-label>
          <nz-form-control
            ><input nz-input formControlName="lookupCode" maxlength="100"
          /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label>{{ text.taxAuthorityCode }}</nz-form-label>
          <nz-form-control>
            <input nz-input formControlName="taxAuthorityCode" maxlength="100" />
          </nz-form-control>
        </nz-form-item>
      </div>

      @if (mode() === 'adjust') {
        <nz-form-item>
          <nz-form-label nzRequired>{{ text.direction }}</nz-form-label>
          <nz-radio-group formControlName="direction">
            <label nz-radio-button nzValue="INCREASE">{{ text.increase }}</label>
            <label nz-radio-button nzValue="DECREASE">{{ text.decrease }}</label>
          </nz-radio-group>
        </nz-form-item>
      }
      @if (mode() !== 'issue') {
        <nz-form-item>
          <nz-form-label nzRequired>
            {{ mode() === 'adjust' ? text.adjustAmount : text.replaceAmount }}
          </nz-form-label>
          <nz-form-control [nzErrorTip]="text.required">
            <nz-input-number
              formControlName="subtotal"
              [nzMin]="1"
              [nzFormatter]="moneyFormatter"
              [nzParser]="moneyParser"
            />
          </nz-form-control>
        </nz-form-item>
        @if (mode() === 'replace') {
          <nz-form-item>
            <nz-form-label>{{ text.buyer }}</nz-form-label>
            <nz-form-control
              ><input nz-input formControlName="buyerName" maxlength="300"
            /></nz-form-control>
          </nz-form-item>
          <div class="grid">
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
          </div>
        }
        <nz-form-item>
          <nz-form-label nzRequired>{{ text.reason }}</nz-form-label>
          <nz-form-control nzErrorTip="Lý do từ 5 đến 500 ký tự">
            <textarea nz-input rows="2" formControlName="reason" maxlength="500"></textarea>
          </nz-form-control>
        </nz-form-item>
      }

      <div class="file">
        <span>{{ text.pdf }}</span>
        <input
          #pdfPicker
          type="file"
          accept=".pdf,application/pdf"
          hidden
          (change)="pick('pdf', $event)"
        />
        <button nz-button nzSize="small" type="button" (click)="pdfPicker.click()">
          {{ text.chooseFile }}
        </button>
        <span class="muted">{{ pdf()?.name ?? text.noFile }}</span>
      </div>
      <div class="file">
        <span>{{ text.xml }}</span>
        <input #xmlPicker type="file" accept=".xml" hidden (change)="pick('xml', $event)" />
        <button nz-button nzSize="small" type="button" (click)="xmlPicker.click()">
          {{ text.chooseFile }}
        </button>
        <span class="muted">{{ xml()?.name ?? text.noFile }}</span>
      </div>

      <div class="actions">
        <button nz-button type="button" (click)="cancelled.emit()">{{ text.close }}</button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!pdf()"
          [nzLoading]="busy()"
          (click)="submit()"
        >
          {{ text.save }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0 12px;
    }
    nz-input-number,
    nz-date-picker {
      width: 100%;
    }
    .file {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      word-break: break-all;
    }
    .muted {
      color: rgba(0, 0, 0, 0.45);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceRecordFormComponent implements OnInit {
  readonly mode = input<RecordMode>('issue');
  /** Hoá đơn đang xử lý: thay thế lấy sẵn người mua, giá trị cũ, mẫu số và ký hiệu. */
  readonly invoice = input<InvoiceDetail | null>(null);
  readonly busy = input(false);
  readonly saved = output<InvoiceRecordInput>();
  readonly cancelled = output<void>();

  protected readonly text = INVOICES_TEXT;
  protected readonly moneyFormatter = moneyFormatter;
  protected readonly moneyParser = moneyParser;
  protected readonly pdf = signal<File | null>(null);
  protected readonly xml = signal<File | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    templateCode: ['', Validators.required],
    symbol: ['', Validators.required],
    number: ['', Validators.required],
    issueDate: [new Date() as Date | null, Validators.required],
    lookupCode: [''],
    taxAuthorityCode: [''],
    direction: ['DECREASE' as 'INCREASE' | 'DECREASE'],
    subtotal: [0],
    reason: [''],
    buyerName: [''],
    buyerTaxCode: [''],
    buyerAddress: [''],
  });

  ngOnInit(): void {
    const inv = this.invoice();
    if (inv) {
      this.form.patchValue({
        templateCode: inv.templateCode ?? '',
        symbol: inv.symbol ?? '',
        subtotal: this.mode() === 'replace' ? Math.abs(Number(inv.subtotal)) : 0,
        buyerName: inv.buyerName ?? '',
        buyerTaxCode: inv.buyerTaxCode ?? '',
        buyerAddress: inv.buyerAddress ?? '',
      });
    }
    if (this.mode() !== 'issue') {
      this.form.controls.subtotal.setValidators([Validators.required, Validators.min(1)]);
      this.form.controls.reason.setValidators([
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(500),
      ]);
    }
  }

  /** Ngày lập không sau hôm nay. */
  protected readonly future = (d: Date): boolean => d > new Date();

  protected pick(kind: 'pdf' | 'xml', event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    (kind === 'pdf' ? this.pdf : this.xml).set(file);
  }

  protected submit(): void {
    const pdf = this.pdf();
    if (this.form.invalid || !pdf) {
      this.form.markAllAsTouched();
      Object.values(this.form.controls).forEach((c) => c.updateValueAndValidity());
      return;
    }
    const v = this.form.getRawValue();
    const mode = this.mode();
    this.saved.emit({
      templateCode: v.templateCode.trim(),
      symbol: v.symbol.trim(),
      number: v.number.trim(),
      issueDate: toDateKey(v.issueDate!),
      lookupCode: v.lookupCode.trim() || undefined,
      taxAuthorityCode: v.taxAuthorityCode.trim() || undefined,
      pdf,
      xml: this.xml(),
      ...(mode !== 'issue' && { subtotal: String(v.subtotal), reason: v.reason.trim() }),
      ...(mode === 'adjust' && { direction: v.direction }),
      ...(mode === 'replace' && {
        buyerName: v.buyerName.trim() || undefined,
        buyerTaxCode: v.buyerTaxCode.trim() || undefined,
        buyerAddress: v.buyerAddress.trim() || undefined,
      }),
    });
  }
}
