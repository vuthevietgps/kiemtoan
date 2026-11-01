import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { FinancePanelComponent } from '../components/finance-panel.component';
import { OperationsPanelComponent } from '../components/operations-panel.component';
import {
  DashboardApi,
  FinanceData,
  OperationsData,
  ServiceRow,
} from '../data-access/dashboard.api';
import { currentMonthRange, toDateParam } from '../data-access/format';

/**
 * Tổng quan (đặc tả 10-B, M1): tab Vận hành mặc định cho mọi người; tab Tài chính chỉ hiện khi có
 * `finance:view` và chỉ tải khi mở. Bộ lọc kỳ áp cho thẻ dịch vụ hoàn thành và tab Tài chính.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzDatePickerModule,
    NzModalModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    FinancePanelComponent,
    OperationsPanelComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);

  protected readonly range = signal<Date[]>(currentMonthRange());
  protected readonly tab = signal(0);
  protected readonly operations = signal<OperationsData | null>(null);
  protected readonly finance = signal<FinanceData | null>(null);
  protected readonly loading = signal(false);
  protected readonly canFinance = computed(() => this.auth.can('finance:view'));
  protected readonly firstName = computed(() => this.auth.user()?.fullName ?? '');
  /** Danh sách dịch vụ của thẻ "Dịch vụ hoàn thành" (M3). */
  protected readonly servicesOpen = signal(false);
  protected readonly serviceState = signal<'done' | 'open'>('done');
  protected readonly services = signal<ServiceRow[]>([]);

  constructor() {
    this.load();
  }

  protected onRangeChange(value: Date[] | null): void {
    this.range.set(value && value.length === 2 ? value : currentMonthRange());
    this.finance.set(null);
    this.operations.set(null);
    this.load();
  }

  protected selectTab(index: number): void {
    this.tab.set(index);
    if (!(index === 1 ? this.finance() : this.operations())) this.load();
  }

  protected showServices(state: 'done' | 'open'): void {
    const [from, to] = this.params();
    this.serviceState.set(state);
    this.servicesOpen.set(true);
    this.api.services(state, from, to).subscribe({
      next: (rows) => this.services.set(rows),
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }

  private params(): [string, string] {
    const [from, to] = this.range();
    return [toDateParam(from), toDateParam(to)];
  }

  private load(): void {
    const [from, to] = this.params();
    const done = () => this.loading.set(false);
    const failed = (err: unknown) => {
      done();
      this.message.error(errorMessage(err));
    };
    this.loading.set(true);
    if (this.tab() === 1 && this.canFinance())
      this.api.finance(from, to).subscribe({
        next: (data) => {
          this.finance.set(data);
          done();
        },
        error: failed,
      });
    else
      this.api.operations(from, to).subscribe({
        next: (data) => {
          this.operations.set(data);
          done();
        },
        error: failed,
      });
  }
}
