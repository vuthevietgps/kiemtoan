import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { ContractDetail, ContractsApi } from '../../contracts/data-access/contracts.api';
import { DueInstallmentTableComponent } from '../components/due-installment-table.component';
import { PaymentFormComponent, PaymentFormValue } from '../components/payment-form.component';
import { DueFilter, DueInstallment } from '../data-access/payments.api';
import { PaymentsStore } from '../data-access/payments.store';
import { ReceivablesStore } from '../data-access/receivables.store';
import { PAYMENTS_TEXT, RECEIVABLES_TEXT } from '../payments.text';
import { PaymentRequestDialog } from './payment-request.dialog';

/**
 * Sắp đến hạn / Quá hạn (07-D1): danh sách đợt còn nợ để Kế toán thu tiền theo dõi và lập phiếu ngay
 * từ đợt (form chọn sẵn đợt và số còn thiếu), đề nghị thanh toán kèm VietQR (07-D3). Nhắc nợ: 07-D4.
 */
@Component({
  selector: 'app-due-installments-panel',
  imports: [
    FormsModule,
    NzAlertModule,
    NzInputNumberModule,
    NzModalModule,
    NzRadioModule,
    VndPipe,
    DueInstallmentTableComponent,
    PaymentFormComponent,
    PaymentRequestDialog,
  ],
  providers: [ReceivablesStore, PaymentsStore],
  template: `
    <div class="filters">
      <nz-radio-group [ngModel]="store.due()" (ngModelChange)="setDue($event)">
        <label nz-radio-button nzValue="overdue">{{ text.overdueTab }}</label>
        <label nz-radio-button nzValue="upcoming">{{ text.upcomingTab }}</label>
      </nz-radio-group>
      @if (store.due() === 'upcoming') {
        <span class="days">
          {{ text.within }}
          <nz-input-number
            [nzMin]="1"
            [nzMax]="60"
            [ngModel]="store.days()"
            (ngModelChange)="setDays($event)"
          />
          {{ text.daysUnit }}
        </span>
      }
      <span class="sum">{{ text.dueSum }}: <b>{{ store.dueTotal() | vnd }}</b></span>
    </div>
    @if (store.error()) {
      <nz-alert class="notice" nzType="error" nzShowIcon [nzMessage]="store.error()" />
    }
    <app-due-installment-table
      [items]="store.dueItems()"
      [loading]="store.dueLoading()"
      [canCreate]="canCreate()"
      (collect)="startCollect($event)"
      (request)="requesting.set($event)"
      (openContract)="openContract($event)"
    />
    @if (requesting(); as r) {
      <app-payment-request-dialog
        [visible]="true"
        [contractId]="r.contract.id"
        [contractCode]="r.contract.code"
        [installments]="[r]"
        (closed)="requesting.set(null)"
        (created)="requesting.set(null)"
      />
    }
    <nz-modal
      [nzVisible]="!!collecting()"
      [nzTitle]="paymentText.newPayment"
      [nzFooter]="null"
      (nzOnCancel)="collecting.set(null)"
    >
      <ng-container *nzModalContent>
        @if (collecting(); as c) {
          <app-payment-form
            [contractId]="c.contract.id"
            [installments]="c.contract.installments"
            [remaining]="c.contract.remainingAmount"
            [pending]="c.contract.pendingAmount"
            [preset]="{ installmentId: c.installment.id, amount: c.installment.remaining }"
            [busy]="payments.busy()"
            (saved)="save($event)"
            (cancelled)="collecting.set(null)"
          />
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      margin-bottom: 12px;
    }
    .days {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      nz-input-number {
        width: 72px;
      }
    }
    .notice {
      margin-bottom: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DueInstallmentsPanel implements OnInit {
  protected readonly store = inject(ReceivablesStore);
  protected readonly payments = inject(PaymentsStore);
  private readonly auth = inject(AuthService);
  private readonly contractsApi = inject(ContractsApi);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  protected readonly text = RECEIVABLES_TEXT;
  protected readonly paymentText = PAYMENTS_TEXT;
  protected readonly canCreate = computed(() => this.auth.can('payments:create'));
  /** 07-D3: đợt đang lập đề nghị thanh toán. */
  protected readonly requesting = signal<DueInstallment | null>(null);
  protected readonly collecting = signal<{
    installment: DueInstallment;
    contract: ContractDetail;
  } | null>(null);

  ngOnInit(): void {
    void this.store.loadDue();
  }

  protected setDue(due: DueFilter): void {
    this.store.setDue(due);
  }

  protected setDays(days: number | null): void {
    if (days && days >= 1 && days <= 60) this.store.setDue('upcoming', days);
  }

  protected openContract(id: string): void {
    void this.router.navigate(['/contracts', id]);
  }

  protected async startCollect(installment: DueInstallment): Promise<void> {
    try {
      const contract = await firstValueFrom(this.contractsApi.get(installment.contract.id));
      this.collecting.set({ installment, contract });
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }

  protected async save(value: PaymentFormValue): Promise<void> {
    try {
      const result = await this.payments.save(value.input, {
        file: value.file,
        submit: value.submit,
      });
      this.collecting.set(null);
      void this.store.loadDue();
      if (result.submitError)
        this.message.warning(`${this.paymentText.savedDraftOnly}: ${result.submitError}`);
      else this.message.success(this.paymentText.saved);
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }
}
