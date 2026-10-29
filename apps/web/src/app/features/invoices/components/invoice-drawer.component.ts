import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from '../../contracts/contract-labels';
import type { InvoiceDetail } from '../data-access/invoices.api';
import { INVOICE_KIND_LABELS, INVOICES_TEXT, RecordMode } from '../invoices.text';

/**
 * Ngăn chi tiết hoá đơn (08): người mua, tiền, đợt, file PDF/XML, hoá đơn gốc / điều chỉnh / thay thế,
 * lịch sử và thao tác theo trạng thái/quyền. Chỉ phát sự kiện, không gọi API.
 */
@Component({
  selector: 'app-invoice-drawer',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzTagModule,
    NzTimelineModule,
    VndPipe,
  ],
  templateUrl: './invoice-drawer.component.html',
  styleUrl: './invoice-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDrawerComponent {
  readonly detail = input<InvoiceDetail | null>(null);
  readonly busy = input(false);
  readonly error = input('');
  readonly canCreate = input(false);
  readonly canUpdate = input(false);
  readonly closed = output<void>();
  readonly record = output<RecordMode>();
  readonly editBuyer = output<void>();
  readonly cancelRequest = output<string>();
  readonly openInvoice = output<string>();
  readonly openContract = output<string>();
  readonly download = output<{ id: string; fileName: string }>();

  protected readonly text = INVOICES_TEXT;
  protected readonly labels = INVOICE_STATUS_LABELS;
  protected readonly colors = INVOICE_STATUS_COLORS;
  protected readonly kindLabels = INVOICE_KIND_LABELS;
  protected readonly cancelling = signal(false);
  protected readonly reason = signal('');
  protected readonly width = computed(() =>
    typeof window !== 'undefined' && window.innerWidth < 560 ? '100%' : 520,
  );

  protected readonly requested = computed(() => this.detail()?.status === 'REQUESTED');
  /** K6: điều chỉnh trên hoá đơn gốc / thay thế còn hiệu lực. */
  protected readonly canAdjust = computed(() => {
    const d = this.detail();
    return (
      !!d &&
      this.canUpdate() &&
      d.kind !== 'ADJUSTMENT' &&
      (d.status === 'ISSUED' || d.status === 'ADJUSTED')
    );
  });
  /** K6: thay thế hoá đơn đã xuất chưa điều chỉnh. */
  protected readonly canReplace = computed(() => {
    const d = this.detail();
    return !!d && this.canUpdate() && d.kind !== 'ADJUSTMENT' && d.status === 'ISSUED';
  });
  protected readonly reasonValid = computed(() => {
    const n = this.reason().trim().length;
    return n >= 5 && n <= 500;
  });

  constructor() {
    // Đổi hoá đơn hoặc thao tác xong (revision đổi) thì đóng ô lý do đang mở.
    effect(() => {
      this.detail();
      this.cancelling.set(false);
      this.reason.set('');
    });
  }

  protected identity(inv: {
    templateCode: string | null;
    symbol: string | null;
    number: string | null;
  }): string {
    return inv.number
      ? `${inv.templateCode ?? ''}${inv.symbol ?? ''} · ${inv.number}`
      : this.text.notIssued;
  }

  protected confirmCancel(): void {
    if (this.reasonValid()) this.cancelRequest.emit(this.reason().trim());
  }
}
