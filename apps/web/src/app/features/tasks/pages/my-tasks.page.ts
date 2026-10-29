import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { TaskDrawerComponent } from '../components/task-drawer.component';
import {
  MyTab,
  MyTasksResult,
  ReviewQueueRow,
  TaskRow,
  TasksApi,
  UserOption,
} from '../data-access/tasks.api';
import {
  NOT_READY_LABEL,
  quickAction,
  QuickAction,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
} from '../task-labels';
import { UrgencyTagComponent } from '../components/urgency-tag.component';

const TABS: { key: MyTab; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'upcoming', label: 'Sắp đến hạn' },
  { key: 'overdue', label: 'Quá hạn' },
  { key: 'done', label: 'Đã hoàn thành' },
];

/**
 * Việc của tôi (đặc tả 05-E, H11): 4 tab Hôm nay / Sắp đến hạn (≤ 7 ngày) / Quá hạn / Đã hoàn thành,
 * và hàng đợi "Chờ tôi kiểm tra / phê duyệt" với thời gian đã chờ (cảnh báo quá SLA 2 ngày làm việc).
 */
@Component({
  selector: 'app-my-tasks-page',
  imports: [
    UrgencyTagComponent,
    DatePipe,
    RouterLink,
    NzButtonModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TaskDrawerComponent,
  ],
  template: `
    <app-page-header
      title="Việc của tôi"
      subtitle="Việc được giao cho tôi và việc chờ tôi soát xét"
    >
      <a nz-button routerLink="/tasks">Tất cả công việc</a>
      <a nz-button routerLink="/tasks/documents">Hồ sơ khách hàng</a>
    </app-page-header>

    <nz-tabs
      [nzSelectedIndex]="tabIndex()"
      (nzSelectedIndexChange)="tabIndex.set($event); page.set(1)"
    >
      @for (t of tabs; track t.key) {
        <nz-tab [nzTitle]="t.label + ' (' + (result()?.counts?.[t.key] ?? 0) + ')'" />
      }
      <nz-tab [nzTitle]="'Chờ tôi kiểm tra / phê duyệt (' + queue().length + ')'" />
    </nz-tabs>

    <div class="panel">
      @if (tabIndex() < tabs.length) {
        <nz-table
          #table
          [nzData]="result()?.items ?? []"
          [nzLoading]="loading()"
          [nzFrontPagination]="false"
          [nzTotal]="result()?.total ?? 0"
          [nzPageIndex]="page()"
          [nzPageSize]="pageSize"
          [nzScroll]="{ x: '760px' }"
          nzSize="middle"
          (nzPageIndexChange)="page.set($event)"
        >
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Công việc</th>
              <th nzWidth="120px">Hạn</th>
              <th nzWidth="150px">Trạng thái</th>
              <th nzWidth="100px">Ưu tiên</th>
              <th nzWidth="130px"></th>
            </tr>
          </thead>
          <tbody>
            @for (r of table.data; track r.id) {
              <tr>
                <td>{{ r.customer.name }}</td>
                <td>
                  <a (click)="selectedId.set(r.id)">{{ r.title }}</a>
                  @if (r.period) {
                    <span class="muted"> · {{ r.period }}</span>
                  }
                </td>
                <td [class.overdue]="r.isOverdue">
                  {{ r.dueDate | date: 'dd/MM/yyyy' }}
                  @if (r.isStatutory) {
                    <nz-tag nzColor="red">PL</nz-tag>
                  }
                  <app-urgency-tag [urgency]="r.urgency" />
                </td>
                <td>
                  <nz-tag [nzColor]="statusColors[r.status]">{{ statusLabels[r.status] }}</nz-tag>
                  @if (r.waitingFor.length) {
                    <nz-tag>{{ notReady }}</nz-tag>
                  }
                </td>
                <td>
                  <nz-tag [nzColor]="priorityColors[r.priority]">{{
                    priorityLabels[r.priority]
                  }}</nz-tag>
                </td>
                <td>
                  @if (actionOf(r); as a) {
                    <button nz-button nzSize="small" (click)="act(r, a)">{{ a.label }}</button>
                  } @else {
                    <button nz-button nzSize="small" nzType="link" (click)="selectedId.set(r.id)">
                      Chi tiết
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      } @else {
        <nz-table
          #queueTable
          [nzData]="queue()"
          [nzLoading]="loading()"
          [nzScroll]="{ x: '760px' }"
          nzSize="middle"
        >
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Công việc</th>
              <th nzWidth="90px">Cấp</th>
              <th nzWidth="140px">Người làm</th>
              <th nzWidth="130px">Đã chờ</th>
              <th nzWidth="110px">Hạn</th>
            </tr>
          </thead>
          <tbody>
            @for (r of queueTable.data; track r.id) {
              <tr>
                <td>{{ r.customer.name }}</td>
                <td>
                  <a (click)="selectedId.set(r.id)">{{ r.title }}</a>
                </td>
                <td>{{ r.reviewLevel === 1 ? 'Kiểm tra' : 'Phê duyệt' }}</td>
                <td>{{ r.assignee?.fullName ?? '—' }}</td>
                <td>
                  <span [class.overdue]="r.overSla">{{ r.waitingDays }} ngày làm việc</span>
                  @if (r.overSla) {
                    <nz-tag nzColor="red">Quá SLA</nz-tag>
                  }
                </td>
                <td [class.overdue]="r.isOverdue">{{ r.dueDate | date: 'dd/MM/yyyy' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </div>

    <app-task-drawer
      [taskId]="selectedId()"
      [users]="users()"
      (closed)="selectedId.set(null)"
      (changed)="reload()"
    />
  `,
  styles: `
    .muted {
      color: rgba(0, 0, 0, 0.55);
      font-size: 12px;
    }
    .overdue {
      color: #cf1322;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTasksPage {
  private readonly api = inject(TasksApi);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  protected readonly tabs = TABS;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly statusColors = TASK_STATUS_COLORS;
  protected readonly priorityLabels = TASK_PRIORITY_LABELS;
  protected readonly priorityColors = TASK_PRIORITY_COLORS;
  protected readonly notReady = NOT_READY_LABEL;
  protected readonly pageSize = 20;

  protected readonly tabIndex = signal(0);
  protected readonly page = signal(1);
  protected readonly result = signal<MyTasksResult | null>(null);
  protected readonly queue = signal<ReviewQueueRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly users = signal<UserOption[]>([]);
  private readonly tab = computed(() => TABS[this.tabIndex()]?.key ?? null);

  constructor() {
    effect(() => {
      const tab = this.tab();
      const page = this.page();
      untracked(() => this.load(tab, page));
    });
    if (this.auth.permissions().has('tasks:approve'))
      this.api.userOptions().subscribe({
        next: (rows) =>
          this.users.set(rows.filter((u) => u.role !== 'ADMIN' && u.role !== 'CASHIER')),
        error: () => this.users.set([]),
      });
  }

  protected actionOf(row: TaskRow): QuickAction | null {
    return quickAction(row);
  }

  protected act(row: TaskRow, action: QuickAction): void {
    if (action.action !== 'start' && row.requiresEvidence && row.evidenceCount === 0) {
      this.selectedId.set(row.id);
      return;
    }
    this.api.act(row.id, action.action).subscribe({
      next: (t) => {
        this.message.success(`"${row.title}" → ${TASK_STATUS_LABELS[t.status]}`);
        this.reload();
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }

  protected reload(): void {
    this.load(this.tab(), this.page());
  }

  private load(tab: MyTab | null, page: number): void {
    this.loading.set(true);
    this.api.reviewQueue().subscribe({
      next: (rows) => this.queue.set(rows),
      error: () => this.queue.set([]),
    });
    this.api.my(tab ?? 'today', tab ? page : 1, this.pageSize).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }
}
