import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../../core/api/api';
import { AuthService } from '../../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import {
  ServiceCatalogApi,
  ServiceType,
} from '../../../service-catalog/data-access/service-catalog.api';
import {
  ACCEPTANCE_LABELS,
  AUDIT_STAGE_LABELS,
  AUDIT_STAGES,
  AUDIT_TEXT,
  CLIENT_DELIVERY_LABELS,
  DEADLINE_RESULT_LABELS,
  INVOICE_LABELS,
  ORIGINAL_FILING_LABELS,
} from '../../audit-tracking.text';
import {
  AuditTrackingApi,
  BoardQuery,
  BoardResult,
  BoardRow,
} from '../../data-access/audit-tracking.api';
import { ContractsApi, UserOption } from '../../data-access/contracts.api';
import { ContractAuditPanel } from '../contract-detail/contract-audit.panel';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
} from '../../../tasks/task-labels';
import { AuditPeoplePanel } from './audit-people.panel';

type Filters = Omit<BoardQuery, 'page' | 'pageSize' | 'sort' | 'order'>;
const TEXT_KEYS = [
  'search',
  'serviceTypeId',
  'stage',
  'priority',
  'ownerId',
  'managerId',
  'leadId',
  'signerId',
  'deadline',
] as const;
const FLAG_KEYS = ['dossierIncomplete', 'uninvoiced', 'receivable'] as const;

/** Theo dõi HĐ kiểm toán (đặc tả 04-F3): tab Hồ sơ (bảng, ngăn chi tiết) và tab Theo nhân sự. */
@Component({
  selector: 'app-audit-tracking-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    VndPipe,
    ContractAuditPanel,
    AuditPeoplePanel,
  ],
  templateUrl: './audit-tracking.page.html',
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
    }
    .filters nz-select {
      min-width: 160px;
    }
    .filters nz-input-group {
      width: 260px;
      max-width: 100%;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .card {
      padding: 8px 12px;
      border: 1px solid #f0f0f0;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
    }
    .card b {
      display: block;
      font-size: 20px;
    }
    .card span {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.55);
    }
    .muted {
      color: rgba(0, 0, 0, 0.55);
      font-size: 12px;
    }
    tr.clickable {
      cursor: pointer;
    }
    .note {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditTrackingPage implements OnInit {
  private readonly api = inject(AuditTrackingApi);
  private readonly contracts = inject(ContractsApi);
  private readonly catalog = inject(ServiceCatalogApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  protected readonly auth = inject(AuthService);

  protected readonly text = AUDIT_TEXT;
  protected readonly stages = AUDIT_STAGES;
  protected readonly stageLabels = AUDIT_STAGE_LABELS;
  protected readonly priorities = TASK_PRIORITIES;
  protected readonly priorityLabels = TASK_PRIORITY_LABELS;
  protected readonly priorityColors = TASK_PRIORITY_COLORS;
  protected readonly resultLabels = DEADLINE_RESULT_LABELS;
  protected readonly deliveryLabels = CLIENT_DELIVERY_LABELS;
  protected readonly filingLabels = ORIGINAL_FILING_LABELS;
  protected readonly acceptanceLabels = ACCEPTANCE_LABELS;
  protected readonly invoiceLabels = INVOICE_LABELS;
  protected readonly deadlineOptions = Object.entries(AUDIT_TEXT.deadlineOptions).map(
    ([value, label]) => ({ value, label }),
  );
  protected readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + 1 - i);
  protected readonly finance = this.auth.can('finance:view');

  protected readonly tab = signal(0);
  protected readonly result = signal<BoardResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly services = signal<ServiceType[]>([]);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(50);
  protected readonly sort = signal<BoardQuery['sort']>(null);
  protected readonly order = signal<BoardQuery['order']>(null);
  protected readonly selected = signal<BoardRow | null>(null);
  protected readonly drawerWidth = computed(() =>
    Math.min(820, typeof window === 'undefined' ? 820 : window.innerWidth),
  );
  protected filters: Filters = {};

  ngOnInit(): void {
    this.readUrl(this.route.snapshot.queryParams);
    this.contracts
      .userOptions()
      .subscribe({ next: (u) => this.users.set(u.filter((x) => x.role !== 'ADMIN')) });
    this.catalog
      .list()
      .subscribe({ next: (s) => this.services.set(s.filter((x) => x.issuesAuditReport)) });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .board({
        ...this.filters,
        page: this.page(),
        pageSize: this.pageSize(),
        sort: this.sort(),
        order: this.order(),
      })
      .subscribe({
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

  /** Áp bộ lọc: về trang 1, ghi lên URL để gửi link cho nhau. */
  protected apply(): void {
    this.page.set(1);
    this.writeUrl();
    this.load();
  }

  protected reset(): void {
    this.filters = {};
    this.apply();
  }

  protected filterStage(stage: BoardQuery['stage'], deadline: BoardQuery['deadline'] = null): void {
    this.filters = { ...this.filters, stage, deadline };
    this.apply();
  }

  protected onQueryParams(params: NzTableQueryParams): void {
    const active = params.sort.find((s) => s.value);
    const sort = (active?.key ?? null) as BoardQuery['sort'];
    const order = active ? (active.value === 'ascend' ? 'asc' : 'desc') : null;
    if (
      params.pageIndex === this.page() &&
      params.pageSize === this.pageSize() &&
      sort === this.sort() &&
      order === this.order()
    )
      return;
    this.page.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.sort.set(sort);
    this.order.set(order);
    this.load();
  }

  protected setTab(index: number): void {
    this.tab.set(index);
    void this.router.navigate([], {
      queryParams: { tab: index ? 'people' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected names(users: { fullName: string }[]): string {
    return users.length > 1
      ? `${users[0].fullName} +${users.length - 1}`
      : (users[0]?.fullName ?? '—');
  }

  private readUrl(q: Params): void {
    const filters: Filters = {};
    for (const key of TEXT_KEYS) if (q[key]) Object.assign(filters, { [key]: q[key] as string });
    for (const key of FLAG_KEYS) if (q[key] === 'true') filters[key] = true;
    if (q['year']) filters.year = Number(q['year']);
    this.filters = filters;
    this.tab.set(q['tab'] === 'people' ? 1 : 0);
  }

  private writeUrl(): void {
    const queryParams: Params = { tab: this.tab() ? 'people' : null };
    for (const key of [...TEXT_KEYS, 'year', ...FLAG_KEYS] as const) {
      const value = this.filters[key];
      queryParams[key] =
        value === undefined || value === null || value === '' || value === false ? null : value;
    }
    void this.router.navigate([], { queryParams, replaceUrl: true });
  }
}
