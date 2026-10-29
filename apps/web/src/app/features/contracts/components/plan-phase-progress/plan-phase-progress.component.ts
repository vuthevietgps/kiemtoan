import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TASK_STATUS_LABELS } from '../../contract-lifecycle.text';
import { PlanStep } from '../../data-access/contract-plans.api';

interface Phase {
  name: string;
  steps: PlanStep[];
  done: number;
  percent: number;
}

/** Tiến độ kế hoạch đã xác nhận theo giai đoạn (PL1 VII.3): thu gọn/mở rộng từng giai đoạn. */
@Component({
  selector: 'app-plan-phase-progress',
  imports: [NzCollapseModule, NzProgressModule, NzTagModule],
  template: `
    <nz-collapse nzGhost>
      @for (phase of phases(); track phase.name) {
        <nz-collapse-panel
          [nzHeader]="phase.name + ' — ' + phase.done + '/' + phase.steps.length"
          [nzExtra]="bar"
        >
          <ng-template #bar
            ><nz-progress [nzPercent]="phase.percent" nzSize="small" [nzWidth]="120"
          /></ng-template>
          @for (step of phase.steps; track step.id) {
            <div>
              {{ step.sortOrder }}. {{ step.name }}
              <nz-tag [nzColor]="status(step).color">{{ status(step).label }}</nz-tag>
            </div>
          }
        </nz-collapse-panel>
      }
    </nz-collapse>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanPhaseProgressComponent {
  readonly steps = input.required<PlanStep[]>();
  /** Nhãn giai đoạn khi bước không ghi giai đoạn. */
  readonly noPhase = input.required<string>();

  protected readonly phases = computed<Phase[]>(() => {
    const groups = new Map<string, PlanStep[]>();
    for (const step of this.steps().filter((s) => !s.skipped)) {
      const name = step.phase || this.noPhase();
      groups.set(name, [...(groups.get(name) ?? []), step]);
    }
    return [...groups.entries()].map(([name, steps]) => {
      const done = steps.filter((s) => this.stepDone(s)).length;
      return { name, steps, done, percent: Math.round((done / steps.length) * 100) };
    });
  });

  /** Bước sinh nhiều kỳ (05-C) hiện số kỳ hoàn thành; một kỳ thì hiện trạng thái việc. */
  protected status(step: PlanStep): { label: string; color: string } {
    const tasks = step.tasks ?? [];
    if (tasks.length > 1) {
      const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
      return {
        label: `${completed}/${tasks.length} kỳ hoàn thành`,
        color: completed === tasks.length ? 'green' : completed ? 'blue' : 'default',
      };
    }
    return TASK_STATUS_LABELS[tasks[0]?.status ?? 'NOT_STARTED'];
  }

  private stepDone(step: PlanStep): boolean {
    const tasks = step.tasks ?? [];
    return tasks.length > 0 && tasks.every((t) => t.status === 'COMPLETED');
  }
}
