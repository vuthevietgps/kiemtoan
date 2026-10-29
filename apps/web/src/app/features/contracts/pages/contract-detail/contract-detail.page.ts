import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  effect,
  untracked,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../../core/api/api';
import { AuthService } from '../../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { CONTRACTS_TEXT, TASK_GENERATION_LABELS } from '../../contracts.text';
import { PaymentTagComponent } from '../../components/payment-tag.component';
import { LIFECYCLE_TEXT } from '../../contract-lifecycle.text';
import { ContractLifecycleApi } from '../../data-access/contract-lifecycle.api';
import { AUDIT_TEXT } from '../../audit-tracking.text';
import { ContractAmendmentsPanel } from './contract-amendments.panel';
import { ContractAuditPanel } from './contract-audit.panel';
import { ContractDocumentsPanel } from './contract-documents.panel';
import { ContractFinancePanel } from './contract-finance.panel';
import { ContractHistoryPanel } from './contract-history.panel';
import { ContractInfoPanel } from './contract-info.panel';
import { ContractPlansPanel } from './contract-plans.panel';
import {
  BILLING_CYCLE_LABELS,
  CONTRACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TRANSITIONS,
  ContractStatus,
} from '../../contract-labels';
import { ContractDetail, ContractsApi } from '../../data-access/contracts.api';

/** Nhãn nút chuyển trạng thái. */
const TRANSITION_LABELS: Partial<Record<ContractStatus, string>> = {
  IN_PROGRESS: 'Bắt đầu thực hiện',
  COMPLETED: 'Hoàn thành',
  LIQUIDATED: 'Thanh lý',
  CANCELLED: 'Huỷ hợp đồng',
};

@Component({
  selector: 'app-contract-detail-page',
  imports: [
    FormsModule,
    NzAlertModule,
    NzInputModule,
    DatePipe,
    RouterLink,
    NzButtonModule,
    NzDescriptionsModule,
    NzIconModule,
    NzModalModule,
    NzProgressModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    CanDirective,
    VndPipe,
    PaymentTagComponent,
    ContractPlansPanel,
    ContractAuditPanel,
    ContractDocumentsPanel,
    ContractInfoPanel,
    ContractAmendmentsPanel,
    ContractFinancePanel,
    ContractHistoryPanel,
  ],
  templateUrl: './contract-detail.page.html',
  styles: `
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .summary div {
      background: #f7f9fc;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .summary span {
      display: block;
      color: #6b7280;
      font-size: 12px;
    }
    .summary b {
      font-size: 16px;
      color: #0f2a4a;
    }
    h3 {
      margin: 0 0 12px;
      font-size: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractDetailPage {
  readonly id = input.required<string>();

  private readonly api = inject(ContractsApi);
  private readonly lifecycleApi = inject(ContractLifecycleApi);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  protected readonly auth = inject(AuthService);

  protected readonly statusLabels = CONTRACT_STATUS_LABELS;
  protected readonly statusColors = CONTRACT_STATUS_COLORS;
  protected readonly cycleLabels = BILLING_CYCLE_LABELS;
  protected readonly transitionLabels = TRANSITION_LABELS;

  protected readonly contract = signal<ContractDetail | null>(null);
  protected readonly busy = signal(false);
  protected readonly text = CONTRACTS_TEXT;
  protected readonly generationLabels = TASK_GENERATION_LABELS;
  protected readonly returnVisible = signal(false);
  protected readonly returnReason = signal('');
  /** HĐ đã duyệt, đang thực hiện mà còn dòng đã xác nhận kế hoạch nhưng chưa sinh việc / bỏ qua / lỗi. */
  protected readonly needsGeneration = computed(() => {
    const c = this.contract();
    return (
      !!c &&
      ['NOT_STARTED', 'IN_PROGRESS'].includes(c.status) &&
      c.services.some(
        (s) =>
          s.plan?.status === 'CONFIRMED' &&
          ['PENDING', 'SKIPPED', 'FAILED'].includes(s.taskGenerationStatus),
      )
    );
  });
  protected readonly lifecycle = LIFECYCLE_TEXT;
  protected readonly auditText = AUDIT_TEXT;
  protected readonly cancelVisible = signal(false);
  protected readonly cancelReason = signal('');
  /** HĐ đã có việc thì lý do huỷ bắt buộc (khớp API). */
  protected readonly hasTasks = computed(() => (this.contract()?.taskProgress.total ?? 0) > 0);
  protected readonly cancelReasonValid = computed(() => {
    const length = this.cancelReason().trim().length;
    return length === 0 ? !this.hasTasks() : length >= 5;
  });
  /** HĐ đã duyệt, chưa có HĐ tái ký còn hiệu lực. */
  protected readonly canRenew = computed(() => {
    const c = this.contract();
    return (
      !!c &&
      ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'LIQUIDATED'].includes(c.status) &&
      !c.renewals.some((r) => r.status !== 'CANCELLED')
    );
  });

  protected readonly editable = computed(() =>
    ['DRAFT', 'PENDING_APPROVAL'].includes(this.contract()?.status ?? ''),
  );
  protected readonly transitions = computed(() => {
    const c = this.contract();
    return c ? CONTRACT_TRANSITIONS[c.status] : [];
  });
  /** HĐ có dòng dịch vụ phát hành BCKT → tab Kiểm toán (04-F). */
  protected readonly hasAudit = computed(
    () => !!this.contract()?.services.some((s) => s.serviceType.issuesAuditReport),
  );
  protected readonly progress = computed(() => {
    const p = this.contract()?.taskProgress;
    return p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
  });

  constructor() {
    // Mở HĐ khác cùng route (ví dụ sau "Tạo HĐ năm sau") thì component được dùng lại → tải theo id.
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.api.get(this.id()).subscribe({
      next: (c) => this.contract.set(c),
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }

  protected submit(): void {
    this.run(this.api.submit(this.id()), 'Đã gửi duyệt hợp đồng');
  }

  protected approve(): void {
    this.confirm(this.text.confirmApprove, () =>
      this.run(this.api.approve(this.id()), 'Đã duyệt hợp đồng'),
    );
  }

  protected openReturn(): void {
    this.returnReason.set('');
    this.returnVisible.set(true);
  }

  protected confirmReturn(): void {
    const reason = this.returnReason().trim();
    if (reason.length < 5) return;
    this.run(this.api.returnToDraft(this.id(), reason), this.text.returned, () =>
      this.returnVisible.set(false),
    );
  }

  protected regenerate(): void {
    this.run(this.api.regenerateTasks(this.id()), this.text.regenerated);
  }

  protected changeStatus(status: ContractStatus): void {
    if (status === 'CANCELLED') {
      this.cancelReason.set('');
      this.cancelVisible.set(true);
      return;
    }
    this.confirm(`Chuyển hợp đồng sang “${this.statusLabels[status]}”?`, () =>
      this.run(this.api.changeStatus(this.id(), status), 'Đã cập nhật trạng thái'),
    );
  }

  /** Hộp xác nhận giữa màn hình (popconfirm bị tràn ở màn hẹp). */
  private confirm(title: string, onOk: () => void): void {
    this.modal.confirm({
      nzTitle: title,
      nzOkText: this.text.confirm,
      nzCancelText: this.text.cancel,
      nzOnOk: onOk,
    });
  }

  protected confirmCancel(): void {
    if (!this.cancelReasonValid()) return;
    const reason = this.cancelReason().trim() || undefined;
    this.run(this.api.changeStatus(this.id(), 'CANCELLED', reason), this.lifecycle.cancelled, () =>
      this.cancelVisible.set(false),
    );
  }

  /** Tạo HĐ năm sau (04-D) rồi mở HĐ mới để rà soát. */
  protected renew(): void {
    this.confirm(this.lifecycle.renewQuestion, () => {
      this.busy.set(true);
      this.lifecycleApi.renew(this.id()).subscribe({
        next: (created) => {
          this.busy.set(false);
          this.message.success(this.lifecycle.renewed(created.code));
          void this.router.navigate(['/contracts', created.id]);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.message.error(errorMessage(err));
        },
      });
    });
  }

  private run(action: Observable<unknown>, success: string, done?: () => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    action.subscribe({
      next: () => {
        this.busy.set(false);
        done?.();
        this.message.success(success);
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }
}
