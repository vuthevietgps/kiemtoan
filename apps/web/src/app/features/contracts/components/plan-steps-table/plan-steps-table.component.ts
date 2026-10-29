import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PlanPreviewStep, PlanStep, PlanStepChange } from '../../data-access/contract-plans.api';
import { UserOption } from '../../data-access/contracts.api';
import { PLAN_TEXT } from '../../contracts.text';

/** Bảng bước của kế hoạch: sửa người/thời lượng/bỏ bước tuỳ chọn khi chưa khoá. Không gọi API. */
@Component({
  selector: 'app-plan-steps-table',
  imports: [
    DatePipe,
    FormsModule,
    NzTableModule,
    NzSelectModule,
    NzInputNumberModule,
    NzCheckboxModule,
    NzTagModule,
  ],
  templateUrl: './plan-steps-table.component.html',
  styles: `
    nz-select {
      width: 100%;
    }
    nz-input-number {
      width: 80px;
    }
    .skipped {
      opacity: 0.5;
      text-decoration: line-through;
    }
    .warn {
      color: #d46b08;
      font-size: 12px;
    }
    .moved {
      color: #1677ff;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanStepsTableComponent {
  readonly steps = input.required<PlanStep[]>();
  readonly mode = input.required<'PERIODIC' | 'PROJECT'>();
  readonly users = input<UserOption[]>([]);
  readonly readonly = input(true);
  /** Thay đổi chưa lưu, để hiển thị giá trị đang sửa. */
  readonly pending = input<Record<string, PlanStepChange>>({});
  /** Lịch xem trước khi áp thay đổi chưa lưu; ngày khác đã lưu được tô màu. */
  readonly preview = input<Record<string, PlanPreviewStep>>({});
  readonly changed = output<PlanStepChange>();

  protected readonly text = PLAN_TEXT;

  protected dates(step: PlanStep): { plannedStart: string | null; dueDate: string } {
    return this.preview()[step.stepKey] ?? step;
  }

  protected value<K extends keyof PlanStepChange>(
    step: PlanStep,
    key: K,
  ): PlanStep[K & keyof PlanStep] {
    const change = this.pending()[step.stepKey];
    return (change && key in change ? change[key] : step[key as keyof PlanStep]) as PlanStep[K &
      keyof PlanStep];
  }
}
