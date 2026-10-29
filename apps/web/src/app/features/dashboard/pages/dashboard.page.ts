import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { CanDirective } from '../../../shared/directives/can.directive';
import { KpiCardComponent } from '../components/kpi-card.component';
import { RecentContractsComponent } from '../components/recent-contracts.component';
import { TaskListComponent } from '../components/task-list.component';
import { donutChart, moneyBarChart } from '../data-access/charts';
import { DashboardApi, DashboardData } from '../data-access/dashboard.api';
import { compactVnd, currentMonthRange, toDateParam } from '../data-access/format';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    FormsModule,
    NgxEchartsDirective,
    NzDatePickerModule,
    NzSpinModule,
    NzTabsModule,
    CanDirective,
    KpiCardComponent,
    RecentContractsComponent,
    TaskListComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly message = inject(NzMessageService);
  protected readonly auth = inject(AuthService);

  protected readonly range = signal<Date[]>(currentMonthRange());
  protected readonly data = signal<DashboardData | null>(null);
  protected readonly loading = signal(false);
  protected readonly compact = compactVnd;

  protected readonly firstName = computed(() => this.auth.user()?.fullName ?? '');

  protected readonly servicePercent = computed(() => {
    const k = this.data()?.kpis;
    return k && k.servicesTotal > 0 ? Math.round((k.servicesDone / k.servicesTotal) * 100) : 0;
  });

  protected readonly revenueChart = computed(() => {
    const rows = this.data()?.revenueByServiceType ?? [];
    return moneyBarChart(
      rows.map((r) => r.name),
      rows.map((r) => Number(r.amount)),
      'Doanh thu',
    );
  });

  protected readonly serviceChart = computed(() => {
    const s = this.data()?.serviceStatus ?? { completed: 0, notCompleted: 0 };
    return donutChart(
      [
        { name: 'Đã hoàn thành', value: s.completed, color: '#2bb673' },
        { name: 'Chưa hoàn thành', value: s.notCompleted, color: '#f5a623' },
      ],
      String(s.completed + s.notCompleted),
    );
  });

  protected readonly paymentChart = computed(() => {
    const p = this.data()?.paymentStatus ?? { paid: '0', remaining: '0' };
    const paid = Number(p.paid);
    const remaining = Number(p.remaining);
    return donutChart(
      [
        { name: 'Đã thu', value: paid, color: '#1f5fbf' },
        { name: 'Còn phải thu', value: remaining, color: '#e5534b' },
      ],
      compactVnd(paid + remaining),
      true,
    );
  });

  constructor() {
    this.load();
  }

  protected onRangeChange(value: Date[] | null): void {
    this.range.set(value && value.length === 2 ? value : currentMonthRange());
    this.load();
  }

  private load(): void {
    const [from, to] = this.range();
    this.loading.set(true);
    this.api.load(toDateParam(from), toDateParam(to)).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }
}
