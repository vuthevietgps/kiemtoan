import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { OperationsData } from '../data-access/dashboard.api';
import { DueListComponent } from './due-list.component';
import { KpiCardComponent } from './kpi-card.component';

interface CardLink {
  key: string;
  label: string;
  icon: string;
  color: string;
  value: number | null;
  hint: string;
  link?: { path: string; query: Record<string, string> };
}

/**
 * Tab Vận hành (10-B; PL1, M1–M3): 6 thẻ — bấm mở danh sách module có bộ lọc tương ứng (thẻ dịch vụ mở
 * danh sách ngay trên trang); bên trái việc cần ưu tiên và tiến độ HĐ đang thực hiện, bên phải lịch hạn
 * 14 ngày và thông báo quan trọng. Không có số tiền. Thẻ null (không có quyền) không hiện.
 */
@Component({
  selector: 'app-operations-panel',
  imports: [
    DatePipe,
    RouterLink,
    NzEmptyModule,
    NzProgressModule,
    DueListComponent,
    KpiCardComponent,
  ],
  template: `
    <section class="cards">
      @for (c of cards(); track c.key) {
        @if (c.link) {
          <a class="card" [routerLink]="c.link.path" [queryParams]="c.link.query">
            <app-kpi-card
              [label]="c.label"
              [icon]="c.icon"
              [color]="c.color"
              [value]="'' + c.value"
              [hint]="c.hint"
            />
          </a>
        } @else {
          <button type="button" class="card" (click)="openServices.emit()">
            <app-kpi-card
              [label]="c.label"
              [icon]="c.icon"
              [color]="c.color"
              [value]="c.value + '/' + data().cards.services.total"
              [hint]="c.hint"
              [progress]="servicePercent()"
            />
          </button>
        }
      }
    </section>

    <section class="columns">
      <div class="column">
        @if (data().priorityTasks; as tasks) {
          <div class="panel">
            <h3>Công việc cần ưu tiên</h3>
            <app-due-list [items]="tasks" [showAssignee]="true" emptyText="Không có việc cần làm" />
          </div>
        }
        <div class="panel">
          <h3>Tiến độ hợp đồng đang thực hiện</h3>
          @for (p of data().contractProgress; track p.id) {
            <a class="progress-row" [routerLink]="['/contracts', p.id]">
              <div class="head">
                <b>{{ p.code }}</b>
                <span class="muted">{{ p.customerName }}</span>
                @if (p.endDate) {
                  <span class="muted">· đến {{ p.endDate | date: 'dd/MM/yyyy' }}</span>
                }
              </div>
              @if (p.percent === null) {
                <span class="muted">Chưa có việc</span>
              } @else {
                <nz-progress [nzPercent]="p.percent" nzSize="small" />
                <span class="muted">{{ p.tasksDone }}/{{ p.tasksAll }} việc hoàn thành</span>
              }
            </a>
          } @empty {
            <nz-empty
              nzNotFoundImage="simple"
              nzNotFoundContent="Không có hợp đồng đang thực hiện"
            />
          }
        </div>
      </div>
      <div class="column">
        <div class="panel">
          <h3>Lịch hạn 14 ngày tới</h3>
          <app-due-list [items]="data().deadlines" emptyText="Không có hạn trong 14 ngày tới" />
        </div>
        <div class="panel">
          <h3>
            Thông báo quan trọng
            @if (data().notifications.unread) {
              <span class="count">{{ data().notifications.unread }}</span>
            }
          </h3>
          @for (n of data().notifications.items; track n.id) {
            <button
              type="button"
              class="notice"
              [class.danger]="n.severity === 'DANGER'"
              (click)="go(n.link)"
            >
              <span>{{ n.title }}</span>
              <span class="muted">{{ n.createdAt | date: 'dd/MM HH:mm' }}</span>
            </button>
          } @empty {
            <nz-empty
              nzNotFoundImage="simple"
              nzNotFoundContent="Không có thông báo quan trọng chưa đọc"
            />
          }
        </div>
      </div>
    </section>
  `,
  styleUrl: './operations-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationsPanelComponent {
  readonly data = input.required<OperationsData>();
  readonly openServices = output<void>();
  private readonly router = inject(Router);

  /** Liên kết thông báo là đường dẫn trong ứng dụng, có thể kèm `?id=`. */
  protected go(link: string | null): void {
    if (link) void this.router.navigateByUrl(link);
  }

  protected readonly servicePercent = computed(() => {
    const s = this.data().cards.services;
    return s.total ? Math.round((s.done / s.total) * 100) : 0;
  });

  /** M2 + M3: thẻ và danh sách mở ra khi bấm (cùng điều kiện lọc với trang đích). */
  protected readonly cards = computed((): CardLink[] => {
    const c = this.data().cards;
    const all: CardLink[] = [
      {
        key: 'contracts',
        label: 'Hợp đồng đang thực hiện',
        icon: 'file-text',
        color: '#14a3b8',
        value: c.activeContracts,
        hint: 'Số hợp đồng',
        link: { path: '/contracts', query: { status: 'IN_PROGRESS' } },
      },
      {
        key: 'open',
        label: 'Công việc cần làm',
        icon: 'unordered-list',
        color: '#1f5fbf',
        value: c.openTasks,
        hint: 'Chưa hoàn thành',
        link: { path: '/tasks', query: { card: 'remaining' } },
      },
      {
        key: 'overdue',
        label: 'Công việc quá hạn',
        icon: 'warning',
        color: '#e5534b',
        value: c.overdueTasks,
        hint: 'Chưa hoàn thành, đã quá hạn',
        link: { path: '/tasks', query: { card: 'overdue' } },
      },
      {
        key: 'waiting',
        label: 'Chờ khách cung cấp hồ sơ',
        icon: 'paper-clip',
        color: '#f5a623',
        value: c.waitingCustomer,
        hint: 'Yêu cầu đã gửi / cần bổ sung',
        link: { path: '/tasks/documents', query: { status: 'WAITING' } },
      },
      {
        key: 'review',
        label: 'Chờ tôi phê duyệt',
        icon: 'check-square',
        color: '#7b61ff',
        value: c.awaitingMyReview,
        hint: 'Việc chờ tôi kiểm tra / phê duyệt',
        link: { path: '/tasks/my', query: { tab: 'review' } },
      },
      {
        key: 'services',
        label: 'Dịch vụ hoàn thành',
        icon: 'check-circle',
        color: '#2bb673',
        value: c.services.done,
        hint: 'Hoàn thành trong kỳ / đang chạy',
      },
    ];
    return all.filter((card) => card.value !== null);
  });
}
