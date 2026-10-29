import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { saveFile } from '../../deadlines/save-file';
import { PaymentRequestStore } from '../data-access/payment-request.store';
import { PAYMENT_REQUEST_TEXT } from '../payments.text';

/** Đợt còn nợ có thể đưa vào đề nghị thanh toán. */
export interface RequestableInstallment {
  id: string;
  name: string;
  dueDate: string;
  remaining: string;
}

/**
 * Hộp thoại đề nghị thanh toán (07-D3, J9): chọn đợt còn nợ của một HĐ, xem trước số tiền, nội dung
 * chuyển khoản và mã VietQR, tạo file Word (lưu kho hồ sơ HĐ) và tải về.
 */
@Component({
  selector: 'app-payment-request-dialog',
  imports: [
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzModalModule,
    NzSpinModule,
    VndPipe,
  ],
  providers: [PaymentRequestStore],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="text.title + ' — ' + contractCode()"
      [nzFooter]="null"
      [nzWidth]="560"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <p class="label">{{ text.pick }}</p>
        @for (i of installments(); track i.id) {
          <label
            nz-checkbox
            class="row"
            [nzChecked]="isPicked(i.id)"
            (nzCheckedChange)="toggle(i.id, $event)"
          >
            {{ i.name }} · {{ i.dueDate | date: 'dd/MM/yyyy' }} — <b>{{ i.remaining | vnd }}</b>
          </label>
        }
        @if (store.error()) {
          <nz-alert class="block" nzType="error" nzShowIcon [nzMessage]="store.error()" />
        }
        <nz-spin [nzSpinning]="store.loading()">
          @if (store.preview(); as p) {
            <div class="preview">
              <div class="facts">
                <div>{{ text.amount }}: <b>{{ p.amount | vnd }}</b></div>
                <div class="muted">{{ p.amountInWords }}</div>
                <div>{{ text.transfer }}: <b>{{ p.transferContent }}</b></div>
                <div>
                  {{ text.account }}: {{ p.bank.accountNumber || '—' }} · {{ p.bank.bankName }}
                </div>
                <div class="muted">{{ p.bank.accountName }}</div>
              </div>
              @if (p.qrImage) {
                <img class="qr" [src]="p.qrImage" [alt]="text.qrAlt" />
              } @else {
                <nz-alert class="block" nzType="warning" [nzMessage]="text.noBank" />
              }
            </div>
          }
        </nz-spin>
        <p class="muted hint">{{ text.hint }}</p>
        <div class="actions">
          <button nz-button type="button" (click)="closed.emit()">{{ text.close }}</button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!picked().length || !store.preview()"
            [nzLoading]="store.busy()"
            (click)="create()"
          >
            {{ text.create }}
          </button>
        </div>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .label {
      margin-bottom: 6px;
      font-weight: 500;
    }
    .row {
      display: flex;
      margin: 0 0 6px;
    }
    .block {
      margin: 8px 0;
    }
    .preview {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
      margin-top: 12px;
      padding: 12px;
      border: 1px solid #f0f0f0;
      border-radius: 8px;
      background: #fafafa;
    }
    .facts {
      flex: 1 1 220px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      word-break: break-word;
    }
    .qr {
      width: 160px;
      height: 160px;
    }
    .muted {
      color: rgba(0, 0, 0, 0.5);
    }
    .hint {
      margin-top: 8px;
      font-size: 12px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentRequestDialog {
  readonly visible = input(false);
  readonly contractId = input.required<string>();
  readonly contractCode = input('');
  readonly installments = input<RequestableInstallment[]>([]);
  /** Đợt chọn sẵn khi mở; bỏ trống = chọn mọi đợt. */
  readonly preselected = input<string[] | null>(null);
  readonly closed = output<void>();
  readonly created = output<void>();

  protected readonly store = inject(PaymentRequestStore);
  private readonly message = inject(NzMessageService);
  protected readonly text = PAYMENT_REQUEST_TEXT;
  protected readonly picked = signal<string[]>([]);

  constructor() {
    // Mỗi lần mở: chọn lại đợt mặc định và xem trước.
    effect(() => {
      if (!this.visible()) return;
      const ids = this.preselected() ?? this.installments().map((i) => i.id);
      this.store.reset();
      this.picked.set(ids);
      void this.store.load(this.contractId(), ids);
    });
  }

  protected isPicked(id: string): boolean {
    return this.picked().includes(id);
  }

  protected toggle(id: string, checked: boolean): void {
    const ids = this.installments()
      .map((i) => i.id)
      .filter((x) => (x === id ? checked : this.picked().includes(x)));
    this.picked.set(ids);
    void this.store.load(this.contractId(), ids);
  }

  protected async create(): Promise<void> {
    const result = await this.store.create(this.contractId(), this.picked());
    if (!result) return;
    saveFile(result.file, result.document.document.fileName);
    this.message.success(this.text.done);
    this.created.emit();
  }
}
