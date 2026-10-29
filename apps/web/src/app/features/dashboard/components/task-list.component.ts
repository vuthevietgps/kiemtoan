import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DashboardTask } from '../data-access/dashboard.api';
import { dueLabel } from '../data-access/format';

/** Danh sách việc gọn: tên việc, khách hàng, hạn và nhãn "Còn N ngày" đổi màu. */
@Component({
  selector: 'app-task-list',
  imports: [RouterLink, DatePipe, NzTagModule, NzEmptyModule],
  template: `
    @for (task of tasks(); track task.id) {
      <a class="row" [routerLink]="['/tasks', task.id]">
        <div class="main">
          <div class="title">{{ task.title }}</div>
          <div class="meta">
            {{ task.customerName }}
            @if (showAssignee() && task.assigneeName) {
              · {{ task.assigneeName }}
            }
            · Hạn {{ task.dueDate | date: 'dd/MM/yyyy' }}
          </div>
        </div>
        @if (task.status === 'COMPLETED') {
          <nz-tag nzColor="green">Đã xong</nz-tag>
        } @else {
          <nz-tag [nzColor]="label(task.daysLeft).color">{{ label(task.daysLeft).text }}</nz-tag>
        }
      </a>
    } @empty {
      <nz-empty nzNotFoundImage="simple" [nzNotFoundContent]="emptyText()" />
    }
  `,
  styles: `
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
      color: inherit;
    }
    .row:last-child {
      border-bottom: 0;
    }
    .main {
      min-width: 0;
    }
    .title {
      font-weight: 500;
      color: #0f2a4a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      font-size: 12px;
      color: #6b7280;
    }
    nz-tag {
      margin: 0;
      flex-shrink: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskListComponent {
  readonly tasks = input.required<DashboardTask[]>();
  readonly showAssignee = input(false);
  readonly emptyText = input('Không có công việc');
  protected readonly label = dueLabel;
}
