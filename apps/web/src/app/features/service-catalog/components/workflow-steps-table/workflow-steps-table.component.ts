import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ScheduleMode, WorkflowStep } from '../../data-access/workflows.api';
import { WORKFLOW_ROLE_LABELS, WORKFLOW_TEXT } from '../../workflow.text';

/** Bảng bước của một phiên bản. Chỉ hiển thị và phát sự kiện sửa/di chuyển/xoá. */
@Component({
  selector: 'app-workflow-steps-table',
  imports: [NzTableModule, NzButtonModule, NzIconModule, NzTagModule, CdkDropList, CdkDrag, CdkDragHandle],
  styles: `.drag-handle { cursor: move; margin-right: 6px; }`,
  templateUrl: './workflow-steps-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowStepsTableComponent {
  readonly steps = input.required<WorkflowStep[]>();
  readonly mode = input.required<ScheduleMode>();
  readonly readonly = input(false);
  readonly edit = output<string>();
  readonly move = output<{ key: string; delta: -1 | 1 }>();
  readonly remove = output<string>();
  /** Kéo thả: vị trí cũ → vị trí mới. */
  readonly reorder = output<{ from: number; to: number }>();
  /** Tên người mặc định theo id. */
  readonly userNames = input<Map<string, string>>(new Map());

  protected readonly text = WORKFLOW_TEXT;
  protected readonly roleLabels = WORKFLOW_ROLE_LABELS;
  protected dropped(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex !== event.currentIndex) this.reorder.emit({ from: event.previousIndex, to: event.currentIndex });
  }

  /** Tên bước theo khoá để hiển thị phụ thuộc. */
  protected readonly names = computed(() => new Map(this.steps().map((s, i) => [s.key, `${i + 1}. ${s.name}`])));
}
