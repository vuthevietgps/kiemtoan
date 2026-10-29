import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AuthService } from '../../../core/auth/auth.service';
import { TaskRow } from '../data-access/tasks.api';
import {
  NOT_READY_LABEL,
  QuickAction,
  quickAction,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  waitingText,
} from '../task-labels';
import { UrgencyTagComponent } from './urgency-tag.component';

/** Bảng công việc có phân trang phía server. */
@Component({
  selector: 'app-task-table',
  imports: [UrgencyTagComponent, DatePipe, NzTableModule, NzTagModule, NzButtonModule, NzIconModule, NzTooltipModule],
  template: `
    <nz-table
      #table
      [nzData]="rows()"
      [nzFrontPagination]="false"
      [nzTotal]="total()"
      [nzPageIndex]="pageIndex()"
      [nzPageSize]="pageSize()"
      [nzLoading]="loading()"
      [nzScroll]="{ x: '1100px' }"
      nzShowSizeChanger
      nzSize="middle"
      (nzPageIndexChange)="pageIndexChange.emit($event)"
      (nzPageSizeChange)="pageSizeChange.emit($event)"
    >
      <thead>
        <tr>
          @if (selectable()) {
            <th nzWidth="40px" [nzChecked]="allChecked()" (nzCheckedChange)="checkAll($event)"></th>
          }
          <th>Công việc</th>
          <th>Khách hàng</th>
          <th>Mã HĐ</th>
          <th>Dịch vụ</th>
          <th>Kỳ</th>
          <th>Hạn</th>
          <th>Người làm</th>
          <th>Trạng thái</th>
          <th>Bằng chứng</th>
          <th nzRight></th>
        </tr>
      </thead>
      <tbody>
        @for (task of table.data; track task.id) {
          <tr>
            @if (selectable()) {
              <td
                [nzChecked]="selected().has(task.id)"
                (nzCheckedChange)="check(task.id, $event)"
              ></td>
            }
            <td>
              <a (click)="open.emit(task)">{{ task.title }}</a>
            </td>
            <td>{{ task.customer.name }}</td>
            <td>{{ task.contract?.code ?? '—' }}</td>
            <td>{{ task.serviceTypeName ?? 'Việc phát sinh' }}</td>
            <td>{{ task.period ?? '—' }}</td>
            <td [class.overdue]="task.isOverdue">
              {{ task.dueDate | date: 'dd/MM/yyyy' }}
              @if (task.isOverdue) {
                <nz-icon nzType="warning" nz-tooltip nzTooltipTitle="Quá hạn" />
              }
            </td>
            <td>{{ task.assignee?.fullName ?? 'Chưa giao' }}</td>
            <td>
              <nz-tag [nzColor]="statusColors[task.status]">{{ statusLabels[task.status] }}</nz-tag>
              @if (task.status === 'IN_REVIEW' && task.reviewLevel) {
                <span class="text-muted">cấp {{ task.reviewLevel }}/{{ task.reviewLevels }}</span>
              }
              @if (task.isStatutory) {
                <nz-tag nzColor="red" nz-tooltip nzTooltipTitle="Hạn pháp lý">PL</nz-tag>
              }
              <app-urgency-tag [urgency]="task.urgency" />
              @if (task.waitingFor.length) {
                <nz-tag nz-tooltip [nzTooltipTitle]="waitingText(task.waitingFor)">{{
                  notReady
                }}</nz-tag>
              }
            </td>
            <td>
              @if (task.evidenceCount > 0) {
                <nz-icon nzType="paper-clip" /> {{ task.evidenceCount }}
              } @else if (task.requiresEvidence) {
                <span class="missing">Chưa có</span>
              } @else {
                <span class="text-muted">Không cần</span>
              }
            </td>
            <td nzRight>
              @if (actionOf(task); as next) {
                <button nz-button nzSize="small" (click)="advance.emit({ task, action: next })">
                  {{ next.label }}
                </button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: `
    .overdue {
      color: #cf1322;
      font-weight: 600;
    }
    .missing {
      color: #d46b08;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskTableComponent {
  private readonly auth = inject(AuthService);

  readonly rows = input<TaskRow[]>([]);
  readonly total = input(0);
  readonly pageIndex = input(1);
  readonly pageSize = input(20);
  readonly loading = input(false);

  readonly pageIndexChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly open = output<TaskRow>();
  readonly advance = output<{ task: TaskRow; action: QuickAction }>();
  /** Chọn nhiều việc để giao lại hàng loạt (người quản lý việc). */
  readonly selectable = input(false);
  readonly selected = input<ReadonlySet<string>>(new Set());
  readonly selectedChange = output<Set<string>>();

  protected allChecked(): boolean {
    const rows = this.rows();
    return rows.length > 0 && rows.every((r) => this.selected().has(r.id));
  }

  protected checkAll(on: boolean): void {
    const next = new Set(this.selected());
    for (const r of this.rows()) {
      if (on) next.add(r.id);
      else next.delete(r.id);
    }
    this.selectedChange.emit(next);
  }

  protected check(id: string, on: boolean): void {
    const next = new Set(this.selected());
    if (on) next.add(id);
    else next.delete(id);
    this.selectedChange.emit(next);
  }

  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly statusColors = TASK_STATUS_COLORS;
  protected readonly notReady = NOT_READY_LABEL;
  protected readonly waitingText = waitingText;

  /** Nút nhanh chỉ cho người làm việc đó. */
  protected actionOf(task: TaskRow): QuickAction | null {
    return task.assignee?.id === this.auth.user()?.id ? quickAction(task) : null;
  }
}
