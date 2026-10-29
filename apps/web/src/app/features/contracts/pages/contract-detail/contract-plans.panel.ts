import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../../core/auth/auth.service';
import { PlanPhaseProgressComponent } from '../../components/plan-phase-progress/plan-phase-progress.component';
import { PlanStepsTableComponent } from '../../components/plan-steps-table/plan-steps-table.component';
import { CONTRACTS_TEXT, PLAN_TEXT, TASK_GENERATION_LABELS } from '../../contracts.text';
import {
  PlanHeaderChange,
  PlanLine,
  PlanPreviewStep,
  PlanStepChange,
} from '../../data-access/contract-plans.api';
import { ContractPlansStore } from '../../data-access/contract-plans.store';
import { ContractDetail } from '../../data-access/contracts.api';
import { fromDateString, toDateString } from '../../form-utils';

/** Trạng thái HĐ còn được lập/sửa kế hoạch (khớp API). */
const PLANNABLE = ['DRAFT', 'PENDING_APPROVAL', 'NOT_STARTED', 'IN_PROGRESS'];

/** Kế hoạch thực hiện từng dòng dịch vụ (đặc tả 04-B): lập, rà soát, xác nhận, mở lại. */
@Component({
  selector: 'app-contract-plans-panel',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTagModule,
    PlanStepsTableComponent,
    PlanPhaseProgressComponent,
  ],
  templateUrl: './contract-plans.panel.html',
  styles: `
    h3 {
      margin: 0 0 4px;
      font-size: 16px;
    }
    .plan-head label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .period-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin: 6px 0;
    }
  `,
  providers: [ContractPlansStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractPlansPanel {
  /** HĐ đang xem; mỗi lần trang tải lại HĐ thì panel tải lại kế hoạch. */
  readonly contract = input.required<ContractDetail>();
  /** Thay đổi kế hoạch có thể sinh việc → trang HĐ tải lại. */
  readonly changed = output<void>();

  protected readonly store = inject(ContractPlansStore);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  protected readonly text = PLAN_TEXT;
  protected readonly contractsText = CONTRACTS_TEXT;
  protected readonly generationLabels = TASK_GENERATION_LABELS;
  protected readonly canPlan = computed(
    () => this.auth.can('contracts:plan') && PLANNABLE.includes(this.contract().status),
  );
  /** Phiên bản chọn khi lập kế hoạch, theo dòng dịch vụ. */
  protected readonly chosen = signal<Record<string, string | null>>({});

  constructor() {
    // Chỉ theo dõi HĐ; load() đọc signal của store nên phải chạy ngoài effect, nếu không sẽ tải lặp vô hạn.
    effect(() => {
      const id = this.contract().id;
      untracked(() => void this.store.load(id));
    });
  }

  protected choose(lineId: string, versionId: string | null): void {
    this.chosen.update((all) => ({ ...all, [lineId]: versionId }));
  }

  protected defaultVersion(line: PlanLine): string | null {
    return (
      this.chosen()[line.id] ?? line.workflowOptions.find((o) => o.template.isDefault)?.id ?? null
    );
  }

  /** Cùng một Date cho cùng ngày: ngModel nhận object mới mỗi lần vẽ sẽ ghi lại vào date picker và vẽ lặp. */
  private readonly dates = new Map<string, Date | null>();

  protected toDate(value: string): Date | null {
    const key = value.slice(0, 10);
    if (!this.dates.has(key)) this.dates.set(key, fromDateString(key));
    return this.dates.get(key) ?? null;
  }

  protected setStart(planId: string, date: Date | null): void {
    const startDate = toDateString(date);
    if (startDate) this.store.changeHeader(planId, { startDate });
  }

  protected pending(planId: string): Record<string, PlanStepChange> {
    return this.store.changes()[planId] ?? {};
  }

  protected header(planId: string): PlanHeaderChange {
    return this.store.headers()[planId] ?? {};
  }

  protected previewOf(planId: string): Record<string, PlanPreviewStep> {
    return this.store.previews()[planId] ?? {};
  }

  protected async create(line: PlanLine): Promise<void> {
    if (await this.store.create(line.id, this.defaultVersion(line)))
      this.message.success(this.text.created);
  }

  protected async save(planId: string, revision: number): Promise<void> {
    if (await this.store.save(planId, revision)) this.message.success(this.text.saved);
  }

  protected confirm(planId: string): void {
    this.modal.confirm({
      nzTitle: this.text.confirmQuestion,
      nzOkText: this.text.confirmOk,
      nzCancelText: this.text.cancel,
      nzOnOk: async () => {
        if (await this.store.confirm(planId)) {
          this.message.success(this.text.confirmedMsg);
          this.changed.emit();
        }
      },
    });
  }

  protected async reopen(planId: string): Promise<void> {
    if (await this.store.reopen(planId)) {
      this.message.success(this.text.reopened);
      this.changed.emit();
    }
  }
}
