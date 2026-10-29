import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ContractStatus, PaymentStatus } from '../contract-labels';
import { shortMoney } from '../form-utils';

/**
 * Tag thanh toán như màn hình mẫu: Đã thanh toán đủ / Đã thu X / Còn nợ X / Chưa thanh toán;
 * 07-D2 thêm "Còn nợ quá hạn X".
 * Hợp đồng đã hoàn thành mà chưa thu đủ → nhấn mạnh "Còn nợ".
 */
@Component({
  selector: 'app-payment-tag',
  imports: [NzTagModule],
  template: `<nz-tag [nzColor]="view().color">{{ view().text }}</nz-tag>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentTagComponent {
  readonly status = input.required<PaymentStatus>();
  readonly contractStatus = input.required<ContractStatus>();
  readonly total = input.required<string>();
  readonly paid = input.required<string>();

  protected readonly view = computed(() => {
    const status = this.status();
    if (status === 'PAID') return { text: 'Đã thanh toán đủ', color: 'green' };
    const remaining = Number(this.total()) - Number(this.paid());
    // 07-D2: có đợt quá hạn chưa thu đủ (quy tắc công nợ chung).
    if (status === 'OVERDUE')
      return { text: `Còn nợ quá hạn ${shortMoney(remaining)}`, color: 'red' };
    if (status === 'UNPAID') return { text: 'Chưa thanh toán', color: 'default' };
    const finished = ['COMPLETED', 'LIQUIDATED'].includes(this.contractStatus());
    return finished
      ? { text: `Còn nợ ${shortMoney(remaining)}`, color: 'red' }
      : { text: `Đã thu ${shortMoney(this.paid())}`, color: 'orange' };
  });
}
