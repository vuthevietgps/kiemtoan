import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../../core/api/api';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { InvoiceRequestFormComponent } from '../../../invoices/components/invoice-request-form.component';
import {
  PaymentFormComponent,
  PaymentFormValue,
} from '../../../payments/components/payment-form.component';
import { PaymentsStore } from '../../../payments/data-access/payments.store';
import {
  PAYMENT_STATE_COLORS,
  PAYMENT_STATE_LABELS,
  PAYMENTS_TEXT,
} from '../../../payments/payments.text';
import {
  ContractStatus,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../contract-labels';
import { ContractDetail } from '../../data-access/contracts.api';

const BILLABLE: ContractStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'LIQUIDATED'];

/**
 * Tab "Thanh toán & Hoá đơn" của HĐ (chỉ hiện với người có quyền tài chính): đợt, phiếu thu, hoá đơn.
 * 07-C: lập phiếu (Nháp → gửi duyệt), không xoá; bấm phiếu mở chi tiết ở màn hình Thu tiền.
 */
@Component({
  selector: 'app-contract-finance-panel',
  imports: [
    DatePipe,
    NzButtonModule,
    NzIconModule,
    NzModalModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    CanDirective,
    VndPipe,
    PaymentFormComponent,
    InvoiceRequestFormComponent,
  ],
  templateUrl: './contract-finance.panel.html',
  styles: `
    h3 {
      margin: 0 0 12px;
      font-size: 16px;
    }
    .collect {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      margin-bottom: 12px;
    }
    .clickable {
      cursor: pointer;
    }
    .small {
      font-size: 12px;
    }
    .danger {
      color: #cf1322;
    }
  `,
  providers: [PaymentsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractFinancePanel {
  readonly contract = input.required<ContractDetail>();
  readonly changed = output<void>();

  protected readonly payments = inject(PaymentsStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly stateLabels = PAYMENT_STATE_LABELS;
  protected readonly stateColors = PAYMENT_STATE_COLORS;
  protected readonly paymentText = PAYMENTS_TEXT;
  protected readonly invoiceLabels = INVOICE_STATUS_LABELS;
  protected readonly invoiceColors = INVOICE_STATUS_COLORS;
  protected readonly paymentVisible = signal(false);
  protected readonly invoiceVisible = signal(false);
  protected readonly canCollect = computed(() => {
    const c = this.contract();
    // J7: chỉ thu cho HĐ đã duyệt (chưa thực hiện / đang thực hiện / hoàn thành / thanh lý).
    return BILLABLE.includes(c.status) && Number(c.remainingAmount) > 0;
  });
  protected readonly uninvoiced = computed(() => {
    const c = this.contract();
    return Number(c.subtotal) - Number(c.invoicedSubtotal);
  });

  protected openPayment(id: string): void {
    void this.router.navigate(['/payments'], { queryParams: { id } });
  }

  protected async onPaymentSaved(value: PaymentFormValue): Promise<void> {
    try {
      const result = await this.payments.save(value.input, { file: value.file, submit: value.submit });
      this.paymentVisible.set(false);
      this.changed.emit();
      if (result.submitError)
        this.message.warning(`${this.paymentText.savedDraftOnly}: ${result.submitError}`);
      else this.message.success(this.paymentText.saved);
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }

  protected onInvoiceSaved(): void {
    this.invoiceVisible.set(false);
    this.changed.emit();
  }
}
