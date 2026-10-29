import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../core/auth/auth.service';
import { TaskRow } from '../data-access/tasks.api';
import {
  NOT_READY_LABEL,
  QuickAction,
  quickAction,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TaskAction,
  TaskStatus,
  waitingText,
} from '../task-labels';
import { UrgencyTagComponent } from './urgency-tag.component';

/** Trạng thái đích của thao tác nhanh — dùng để chỉ cho thả vào đúng cột hợp lệ. */
const TARGET: Record<TaskAction, TaskStatus> = {
  start: 'IN_PROGRESS',
  submit: 'IN_REVIEW',
  complete: 'COMPLETED',
  deliver: 'COMPLETED',
};

/**
 * Kanban 8 cột theo trạng thái (đặc tả 05-E, H11). Người làm kéo thẻ sang cột kế tiếp hợp lệ
 * (bắt đầu, gửi kiểm tra, hoàn thành) hoặc bấm nút; soát xét, chờ khách, tạm dừng làm trong chi tiết việc.
 */
@Component({
  selector: 'app-task-kanban',
  imports: [
    UrgencyTagComponent,
    DatePipe,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    NzButtonModule,
    NzIconModule,
    NzEmptyModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    <nz-spin [nzSpinning]="loading()">
      <div class="board" cdkDropListGroup>
        @for (col of columns(); track col.status) {
          <section
            class="column"
            cdkDropList
            [id]="col.status"
            [cdkDropListData]="col.status"
            [cdkDropListEnterPredicate]="canEnter"
            (cdkDropListDropped)="dropped($event)"
          >
            <header>
              <span>{{ labels[col.status] }}</span>
              <span class="count">{{ col.tasks.length }}</span>
            </header>
            @for (task of col.tasks; track task.id) {
              <article
                class="card"
                cdkDrag
                [cdkDragData]="task"
                [cdkDragDisabled]="!actionOf(task)"
                [class.overdue]="task.isOverdue"
              >
                <a class="title" (click)="open.emit(task)">{{ task.title }}</a>
                <div class="meta">
                  {{ task.customer.name }}{{ task.period ? ' · ' + task.period : '' }}
                </div>
                <div class="meta">
                  <nz-icon nzType="calendar" /> {{ task.dueDate | date: 'dd/MM/yyyy' }}
                  @if (task.isOverdue) {
                    <span class="late">Quá hạn</span>
                  }
                </div>
                <div class="meta">
                  <nz-icon nzType="user" /> {{ task.assignee?.fullName ?? 'Chưa giao' }}
                </div>
                <div class="tags">
                  @if (task.priority !== 'NORMAL') {
                    <nz-tag [nzColor]="priorityColors[task.priority]">{{
                      priorityLabels[task.priority]
                    }}</nz-tag>
                  }
                  @if (task.isStatutory) {
                    <nz-tag nzColor="red">PL</nz-tag>
                  }
                  <app-urgency-tag [urgency]="task.urgency" />
                  @if (task.waitingFor.length) {
                    <nz-tag [title]="waitingText(task.waitingFor)">{{ notReady }}</nz-tag>
                  }
                </div>
                @if (actionOf(task); as next) {
                  <div class="actions">
                    <button
                      nz-button
                      nzType="primary"
                      nzSize="small"
                      (click)="move.emit({ task, action: next })"
                    >
                      {{ next.label }} <nz-icon nzType="arrow-right" />
                    </button>
                  </div>
                }
              </article>
            } @empty {
              <nz-empty nzNotFoundImage="simple" nzNotFoundContent="Không có việc" />
            }
          </section>
        }
      </div>
    </nz-spin>
    @if (truncated()) {
      <p class="text-muted">
        Đang hiển thị {{ rows().length }}/{{ total() }} việc — thu hẹp bộ lọc để xem đủ.
      </p>
    }
  `,
  styles: `
    .board {
      display: grid;
      grid-template-columns: repeat(8, minmax(220px, 1fr));
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 6px;
    }
    .column {
      background: #f4f6fa;
      border-radius: 10px;
      padding: 8px;
      min-height: 200px;
    }
    header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      margin-bottom: 8px;
      padding-bottom: 6px;
      color: #0f2a4a;
      border-bottom: 3px solid #d9d9d9;
    }
    #IN_PROGRESS header {
      border-bottom-color: #1677ff;
    }
    #IN_REVIEW header {
      border-bottom-color: #722ed1;
    }
    #CHANGES_REQUESTED header {
      border-bottom-color: #cf1322;
    }
    #WAITING_CLIENT header {
      border-bottom-color: #fa8c16;
    }
    #APPROVED header {
      border-bottom-color: #13c2c2;
    }
    #COMPLETED header {
      border-bottom-color: #52c41a;
    }
    #ON_HOLD header {
      border-bottom-color: #faad14;
    }
    .count {
      background: #fff;
      border-radius: 10px;
      padding: 0 8px;
      font-weight: 500;
    }
    .card {
      background: #fff;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 8px;
      border-left: 3px solid transparent;
    }
    .card[cdkDrag]:not(.cdk-drag-disabled) {
      cursor: grab;
    }
    .card.overdue {
      border-left-color: #cf1322;
    }
    .cdk-drag-preview {
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
    .title {
      display: block;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .meta {
      color: #6b7280;
      font-size: 12px;
      margin-bottom: 2px;
    }
    .late {
      color: #cf1322;
      font-weight: 600;
      margin-left: 4px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 6px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskKanbanComponent {
  private readonly auth = inject(AuthService);

  readonly rows = input<TaskRow[]>([]);
  readonly total = input(0);
  readonly loading = input(false);
  readonly open = output<TaskRow>();
  readonly move = output<{ task: TaskRow; action: QuickAction }>();

  protected readonly labels = TASK_STATUS_LABELS;
  protected readonly priorityLabels = TASK_PRIORITY_LABELS;
  protected readonly priorityColors = TASK_PRIORITY_COLORS;
  protected readonly notReady = NOT_READY_LABEL;
  protected readonly waitingText = waitingText;
  protected readonly truncated = computed(() => this.total() > this.rows().length);
  protected readonly columns = computed(() =>
    TASK_STATUSES.map((status) => ({
      status,
      tasks: this.rows().filter((t) => t.status === status),
    })),
  );

  /** Nút nhanh/kéo thả chỉ cho người làm việc đó. */
  protected actionOf(task: TaskRow): QuickAction | null {
    return task.assignee?.id === this.auth.user()?.id ? quickAction(task) : null;
  }

  /** Chỉ cho thả vào cột là trạng thái đích của thao tác hợp lệ. */
  protected readonly canEnter = (
    drag: CdkDrag<TaskRow>,
    drop: CdkDropList<TaskStatus>,
  ): boolean => {
    const action = this.actionOf(drag.data);
    return !!action && TARGET[action.action] === drop.data;
  };

  protected dropped(event: CdkDragDrop<TaskStatus, TaskStatus, TaskRow>): void {
    if (event.previousContainer === event.container) return;
    const action = this.actionOf(event.item.data);
    if (action && TARGET[action.action] === event.container.data)
      this.move.emit({ task: event.item.data, action });
  }
}
