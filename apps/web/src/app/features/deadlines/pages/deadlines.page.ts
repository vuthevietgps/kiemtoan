import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { CalendarApi, ObligationTypeOption } from '../../calendar/data-access/calendar.api';
import { TasksApi, UserOption } from '../../tasks/data-access/tasks.api';
import { ObligationDrawerComponent } from '../components/obligation-drawer.component';
import { ObligationSummaryCardsComponent } from '../components/obligation-summary-cards.component';
import { ObligationTableComponent } from '../components/obligation-table.component';
import { ObligationQuery } from '../data-access/obligations.api';
import { DEFAULT_QUERY, ObligationAction, ObligationsStore } from '../data-access/obligations.store';
import {
  DEADLINES_TEXT,
  OBLIGATION_FILTERS,
  OBLIGATION_STATUS_LABELS,
  ObligationDisplayStatus,
} from '../deadlines.text';
import { saveFile } from '../save-file';

/**
 * Lịch báo cáo (06-D2; PDF 4.3): ô đếm, bảng nghĩa vụ theo KH/loại/kỳ/trạng thái/người phụ trách,
 * ngăn chi tiết với thao tác Đang chuẩn bị / Đã nộp (biên nhận) / Không áp dụng / Mở lại.
 * `?id=` mở thẳng một nghĩa vụ (liên kết từ nhắc việc, lịch).
 */
@Component({
  selector: 'app-deadlines-page',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    PageHeaderComponent,
    ObligationSummaryCardsComponent,
    ObligationTableComponent,
    ObligationDrawerComponent,
  ],
  providers: [ObligationsStore],
  templateUrl: './deadlines.page.html',
  styleUrl: './deadlines.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadlinesPage {
  protected readonly store = inject(ObligationsStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly calendarApi = inject(CalendarApi);
  private readonly tasksApi = inject(TasksApi);

  protected readonly text = DEADLINES_TEXT;
  protected readonly statusLabels = OBLIGATION_STATUS_LABELS;
  protected readonly statuses = OBLIGATION_FILTERS;
  protected readonly types = signal<ObligationTypeOption[]>([]);
  protected readonly owners = signal<UserOption[]>([]);
  protected readonly search = signal('');
  protected readonly canUpdate = computed(() => this.auth.can('deadlines:update'));
  protected readonly canApprove = computed(() => this.auth.can('deadlines:approve'));
  /** Lọc người phụ trách chỉ có ý nghĩa với người xem được KH của người khác. */
  protected readonly canFilterOwner = computed(() => this.auth.can('tasks:approve'));
  protected readonly hasFilter = computed(() => {
    const q = this.store.query();
    return !!(q.search || q.status || q.obligationTypeId || q.ownerId);
  });

  constructor() {
    void this.store.load();
    void this.loadOptions();
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) void this.store.open(id);
  }

  protected filter(patch: Partial<ObligationQuery>): void {
    this.store.setQuery(patch);
  }

  protected applySearch(): void {
    const search = this.search().trim();
    if (search !== this.store.query().search) this.store.setQuery({ search });
  }

  protected selectStatus(status: ObligationDisplayStatus | null): void {
    this.store.setQuery({ status });
  }

  protected reset(): void {
    this.search.set('');
    this.store.setQuery({ ...DEFAULT_QUERY });
  }

  protected open(id: string): void {
    void this.store.open(id);
    void this.router.navigate([], { queryParams: { id }, replaceUrl: true });
  }

  protected close(): void {
    this.store.close();
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected async act(action: ObligationAction): Promise<void> {
    if (await this.store.act(action)) this.message.success(this.text.done);
  }

  protected openTask(id: string): void {
    void this.router.navigate(['/tasks'], { queryParams: { id } });
  }

  protected openCustomer(id: string): void {
    void this.router.navigate(['/customers', id]);
  }

  protected async download(doc: { id: string; fileName: string }): Promise<void> {
    try {
      saveFile(await firstValueFrom(this.store.downloadReceipt(doc.id)), doc.fileName);
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }

  private async loadOptions(): Promise<void> {
    const [types, owners] = await Promise.allSettled([
      firstValueFrom(this.calendarApi.obligationTypes()),
      this.canFilterOwner() ? firstValueFrom(this.tasksApi.userOptions()) : Promise.resolve([]),
    ]);
    if (types.status === 'fulfilled') this.types.set(types.value);
    if (owners.status === 'fulfilled') this.owners.set(owners.value);
  }
}
