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
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { PAYMENT_METHOD_LABELS } from '../../contracts/contract-labels';
import type { PaymentDetail } from '../data-access/payments.api';
import type { PaymentAction } from '../data-access/payments.store';
import {
  EDITABLE_STATES,
  PAYMENT_STATE_COLORS,
  PAYMENT_STATE_LABELS,
  PAYMENTS_TEXT,
} from '../payments.text';

type Mode = 'none' | 'return' | 'cancel';

/**
 * Ngăn chi tiết phiếu thu (07-C): thông tin, phân bổ vào đợt, chứng từ, lịch sử và thao tác theo
 * trạng thái/quyền — người lập: sửa, đính kèm, gửi duyệt, rút; người duyệt (khác người lập, J1):
 * duyệt, trả lại, huỷ phiếu đã duyệt có lý do (J5). Chỉ phát sự kiện, không gọi API.
 */
@Component({
  selector: 'app-payment-drawer',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzPopconfirmModule,
    NzTagModule,
    NzTimelineModule,
    VndPipe,
  ],
  templateUrl: './payment-drawer.component.html',
  styleUrl: './payment-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDrawerComponent {
  readonly detail = input<PaymentDetail | null>(null);
  readonly busy = input(false);
  readonly error = input('');
  readonly userId = input<string | null>(null);
  readonly canCreate = input(false);
  readonly canApprove = input(false);
  readonly closed = output<void>();
  readonly action = output<PaymentAction>();
  readonly edit = output<PaymentDetail>();
  readonly openContract = output<string>();
  readonly download = output<{ id: string; fileName: string }>();

  protected readonly text = PAYMENTS_TEXT;
  protected readonly labels = PAYMENT_STATE_LABELS;
  protected readonly colors = PAYMENT_STATE_COLORS;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly mode = signal<Mode>('none');
  protected readonly reason = signal('');
  protected readonly width = computed(() =>
    typeof window !== 'undefined' && window.innerWidth < 520 ? '100%' : 480,
  );

  protected readonly isOwner = computed(
    () => !!this.detail() && this.detail()!.receivedBy.id === this.userId(),
  );
  protected readonly editable = computed(() => {
    const p = this.detail();
    return !!p && this.canCreate() && this.isOwner() && EDITABLE_STATES.includes(p.status);
  });
  protected readonly canWithdraw = computed(() => {
    const s = this.detail()?.status;
    return this.canCreate() && this.isOwner() && (this.editable() || s === 'PENDING');
  });
  protected readonly canReview = computed(
    () => this.canApprove() && !this.isOwner() && this.detail()?.status === 'PENDING',
  );
  protected readonly canCancel = computed(
    () => this.canApprove() && this.detail()?.status === 'APPROVED',
  );
  protected readonly reasonValid = computed(() => {
    const n = this.reason().trim().length;
    return n >= 5 && n <= 500;
  });

  constructor() {
    // Đổi sang phiếu khác hoặc thao tác xong (revision đổi) thì đóng biểu mẫu lý do đang mở.
    effect(() => {
      this.detail();
      this.reset();
    });
  }

  protected start(mode: Mode): void {
    this.reset();
    this.mode.set(mode);
  }

  protected reset(): void {
    this.mode.set('none');
    this.reason.set('');
  }

  protected emit(kind: 'submit' | 'withdraw' | 'approve'): void {
    this.action.emit({ kind });
  }

  protected confirmReason(): void {
    const mode = this.mode();
    if (mode === 'none' || !this.reasonValid()) return;
    this.action.emit({ kind: mode, reason: this.reason().trim() });
  }

  protected pickFile(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) this.action.emit({ kind: 'attach', file });
    target.value = '';
  }
}
