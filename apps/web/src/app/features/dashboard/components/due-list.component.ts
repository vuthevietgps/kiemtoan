import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { dueLabel } from '../data-access/format';

/** Một dòng việc / kỳ báo cáo có hạn trên tổng quan. */
export interface DueItem {
  id: string;
  title: string;
  customerName: string;
  dueDate: string;
  daysLeft: number;
  kind?: 'TASK' | 'OBLIGATION';
  assigneeName?: string | null;
  statutory?: boolean;
}

/**
 * Danh sách gọn có hạn (10-B): tên, khách hàng, hạn, nhãn "Còn N ngày" đổi màu, nhãn "Pháp lý". Bấm mở
 * chi tiết việc (`/tasks?id=`) hoặc kỳ báo cáo (`/deadlines?id=`).
 */
@Component({
  selector: 'app-due-list',
  imports: [RouterLink, DatePipe, NzTagModule, NzEmptyModule],
  template: `
    @for (item of items(); track item.kind + item.id) {
      <a
        class="row"
        [routerLink]="item.kind === 'OBLIGATION' ? '/deadlines' : '/tasks'"
        [queryParams]="{ id: item.id }"
      >
        <div class="main">
          <div class="title">{{ item.title }}</div>
          <div class="meta">
            {{ item.customerName }}
            @if (showAssignee() && item.assigneeName) {
              · {{ item.assigneeName }}
            }
            · Hạn {{ item.dueDate | date: 'dd/MM/yyyy' }}
          </div>
        </div>
        <div class="tags">
          @if (item.statutory) {
            <nz-tag nzColor="purple">Pháp lý</nz-tag>
          }
          <nz-tag [nzColor]="label(item.daysLeft).color">{{ label(item.daysLeft).text }}</nz-tag>
        </div>
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
    .tags {
      display: flex;
      flex-shrink: 0;
      gap: 4px;
    }
    nz-tag {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DueListComponent {
  readonly items = input.required<DueItem[]>();
  readonly showAssignee = input(false);
  readonly emptyText = input('Không có công việc');
  protected readonly label = dueLabel;
}
