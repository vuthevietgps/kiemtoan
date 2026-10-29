import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { CanDirective } from '../../../shared/directives/can.directive';
import {
  SummaryCardKey,
  TaskSummaryCardsComponent,
} from '../components/task-summary-cards.component';
import { TaskCreateModalComponent } from '../components/task-create-modal.component';
import { TaskDrawerComponent } from '../components/task-drawer.component';
import { TaskKanbanComponent } from '../components/task-kanban.component';
import { TaskManagerStatsComponent } from '../components/task-manager-stats.component';
import { TaskTableComponent } from '../components/task-table.component';
import {
  CustomerOption,
  CustomerTaskStats,
  TaskQuery,
  TaskRow,
  TasksApi,
  TaskSummary,
  UserOption,
  WorkloadRow,
} from '../data-access/tasks.api';
import {
  DUE_FILTER_LABELS,
  DueFilter,
  EVIDENCE_REQUIRED_MESSAGE,
  QuickAction,
  STATUS_FILTER_LABELS,
  StatusFilter,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TaskPriority,
} from '../task-labels';

interface Filters {
  status: StatusFilter | null;
  priority: TaskPriority | null;
  reviewerId: string | null;
  statutory: boolean;
  due: DueFilter | null;
  missingEvidence: boolean;
  completedThisMonth: boolean;
  customerId: string | null;
  assigneeId: string | null;
  search: string;
  mine: boolean;
}

type CardFilters = Pick<Filters, 'status' | 'due' | 'missingEvidence' | 'completedThisMonth'>;

const NO_CARD: CardFilters = {
  status: null,
  due: null,
  missingEvidence: false,
  completedThisMonth: false,
};

/** Bộ lọc tương ứng với từng ô đếm. */
const CARD_FILTERS: Record<SummaryCardKey, CardFilters> = {
  today: { ...NO_CARD, status: 'OPEN', due: 'today' },
  remaining: { ...NO_CARD, status: 'OPEN' },
  overdue: { ...NO_CARD, due: 'overdue' },
  missing: { ...NO_CARD, missingEvidence: true },
  review: { ...NO_CARD, status: 'IN_REVIEW' },
  waiting: { ...NO_CARD, status: 'WAITING_CLIENT' },
  done: { ...NO_CARD, completedThisMonth: true },
};

const KANBAN_PAGE_SIZE = 100;

@Component({
  selector: 'app-tasks-page',
  imports: [
    FormsModule,
    RouterLink,
    NzTabsModule,
    NzSelectModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzRadioModule,
    NzCheckboxModule,
    PageHeaderComponent,
    CanDirective,
    TaskSummaryCardsComponent,
    TaskTableComponent,
    TaskKanbanComponent,
    TaskDrawerComponent,
    TaskManagerStatsComponent,
    TaskCreateModalComponent,
  ],
  templateUrl: './tasks.page.html',
  styleUrl: './tasks.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPage {
  private readonly api = inject(TasksApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  /** Query param ?id= (mở sẵn drawer) và ?customerId= (lọc sẵn). */
  readonly id = input<string>();
  readonly customerId = input<string>();

  protected readonly isManager = computed(() => this.auth.permissions().has('tasks:approve'));
  protected readonly statusOptions = Object.entries(STATUS_FILTER_LABELS) as [
    StatusFilter,
    string,
  ][];
  protected readonly dueOptions = Object.entries(DUE_FILTER_LABELS) as [DueFilter, string][];

  protected readonly filters = signal<Filters>({
    ...NO_CARD,
    priority: null,
    reviewerId: null,
    statutory: false,
    customerId: null,
    assigneeId: null,
    search: '',
    mine: false,
  });
  protected readonly view = signal<'table' | 'kanban'>('table');
  protected readonly tabIndex = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(20);
  protected searchText = '';

  protected readonly rows = signal<TaskRow[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly summary = signal<TaskSummary | null>(null);
  protected readonly customers = signal<CustomerOption[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly byCustomer = signal<CustomerTaskStats[]>([]);
  protected readonly workload = signal<WorkloadRow[]>([]);
  protected readonly statsLoading = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly createOpen = signal(false);
  protected readonly priorityOptions = TASK_PRIORITIES.map(
    (p) => [p, TASK_PRIORITY_LABELS[p]] as const,
  );
  /** Giao lại hàng loạt (05-E). */
  protected readonly selectedIds = signal<Set<string>>(new Set());
  protected bulkAssignee: string | null = null;

  protected bulkReassign(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length || !this.bulkAssignee) return;
    this.api.reassign(ids, this.bulkAssignee).subscribe({
      next: (res) => {
        const skipped = res.skipped.length ? `, bỏ qua ${res.skipped.length} việc` : '';
        this.message.success(`Đã giao lại ${res.updated.length} việc${skipped}`);
        this.selectedIds.set(new Set());
        this.bulkAssignee = null;
        this.refresh();
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }

  protected readonly activeCard = computed<SummaryCardKey | null>(() => {
    const f = this.filters();
    const match = (Object.entries(CARD_FILTERS) as [SummaryCardKey, CardFilters][]).find(
      ([, c]) =>
        c.status === f.status &&
        c.due === f.due &&
        c.missingEvidence === f.missingEvidence &&
        c.completedThisMonth === f.completedThisMonth,
    );
    return match?.[0] ?? null;
  });

  private readonly query = computed<TaskQuery>(() => {
    const f = this.filters();
    const kanban = this.view() === 'kanban';
    return {
      page: kanban ? 1 : this.pageIndex(),
      pageSize: kanban ? KANBAN_PAGE_SIZE : this.pageSize(),
      status: f.status,
      due: f.due,
      missingEvidence: f.missingEvidence || null,
      completedThisMonth: f.completedThisMonth || null,
      customerId: f.customerId,
      assigneeId: f.assigneeId,
      search: f.search.trim() || null,
      mine: this.isManager() ? f.mine || null : null,
      priority: f.priority,
      reviewerId: f.reviewerId,
      statutory: f.statutory || null,
    };
  });

  constructor() {
    effect(() => this.selectedId.set(this.id() ?? null));
    effect(() => {
      const customerId = this.customerId() ?? null;
      untracked(() => {
        if (customerId !== this.filters().customerId) this.patchFilters({ customerId });
      });
    });
    effect(() => {
      const q = this.query();
      untracked(() => this.fetch(q));
    });
    effect(() => {
      const mine = this.isManager() && this.filters().mine;
      untracked(() => this.loadSummary(mine));
    });
    this.loadOptions();
  }

  protected patchFilters(patch: Partial<Filters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
    this.pageIndex.set(1);
  }

  protected pickCard(key: SummaryCardKey): void {
    this.patchFilters(this.activeCard() === key ? NO_CARD : CARD_FILTERS[key]);
  }

  protected applySearch(): void {
    this.patchFilters({ search: this.searchText });
  }

  protected resetFilters(): void {
    this.searchText = '';
    this.patchFilters({
      ...NO_CARD,
      priority: null,
      reviewerId: null,
      statutory: false,
      customerId: null,
      assigneeId: null,
      search: '',
    });
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected changeView(view: 'table' | 'kanban'): void {
    this.view.set(view);
  }

  protected onTabChange(index: number): void {
    this.tabIndex.set(index);
    if (index > 0) this.loadStats();
  }

  protected filterCustomer(customerId: string): void {
    this.patchFilters({ customerId, assigneeId: null, mine: false });
    this.tabIndex.set(0);
  }

  protected filterAssignee(assigneeId: string): void {
    this.patchFilters({ assigneeId, customerId: null, mine: false });
    this.tabIndex.set(0);
  }

  protected openTask(task: TaskRow): void {
    void this.router.navigate([], { queryParams: { id: task.id }, queryParamsHandling: 'merge' });
  }

  protected closeDrawer(): void {
    this.selectedId.set(null);
    void this.router.navigate([], { queryParams: { id: null }, queryParamsHandling: 'merge' });
  }

  /** Nút nhanh của người làm ở bảng / kanban. */
  protected move(event: { task: TaskRow; action: QuickAction }): void {
    const { task, action } = event;
    if (action.action !== 'start' && task.requiresEvidence && task.evidenceCount === 0) {
      this.message.warning(EVIDENCE_REQUIRED_MESSAGE);
      this.openTask(task);
      return;
    }
    this.api.act(task.id, action.action).subscribe({
      next: (updated) => {
        this.message.success(`"${task.title}" → ${TASK_STATUS_LABELS[updated.status]}`);
        this.refresh();
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }

  protected refresh(): void {
    this.fetch(this.query());
    this.loadSummary(this.isManager() && this.filters().mine);
    if (this.tabIndex() > 0) this.loadStats();
  }

  private fetch(query: TaskQuery): void {
    this.loading.set(true);
    this.api.list(query).subscribe({
      next: (res) => {
        this.rows.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }

  private loadSummary(mine: boolean): void {
    this.api.summary(mine).subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summary.set(null),
    });
  }

  private loadStats(): void {
    if (!this.isManager()) return;
    this.statsLoading.set(true);
    this.api.byCustomer().subscribe({
      next: (rows) => this.byCustomer.set(rows),
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
    this.api.workload().subscribe({
      next: (rows) => {
        this.workload.set(rows);
        this.statsLoading.set(false);
      },
      error: (err: unknown) => {
        this.statsLoading.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }

  /** Danh sách chọn khách hàng / nhân viên; lỗi thì để trống, không chặn trang. */
  private loadOptions(): void {
    this.api.customerOptions().subscribe({
      next: (rows) => this.customers.set(rows),
      error: () => this.customers.set([]),
    });
    if (this.isManager()) {
      this.api.userOptions().subscribe({
        next: (rows) =>
          this.users.set(rows.filter((u) => u.role !== 'ADMIN' && u.role !== 'CASHIER')),
        error: () => this.users.set([]),
      });
    }
  }
}
