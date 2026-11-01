import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { FormsModule } from '@angular/forms';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { CanDirective } from '../../../shared/directives/can.directive';
import { CapabilityTabComponent } from '../components/capability-tab.component';
import { ContractsReportTabComponent } from '../components/contracts-report-tab.component';
import { CustomersReportTabComponent } from '../components/customers-report-tab.component';
import { DeadlineComplianceTabComponent } from '../components/deadline-compliance-tab.component';
import { ReconciliationPanel } from '../../invoices/pages/reconciliation.panel';
import { ReceivablesPanel } from '../../payments/pages/receivables.panel';
import { ReportContext } from '../data-access/report-context';
import { ReportKey, SavedFiltersApi } from '../data-access/saved-filters.api';
import { RevenueTabComponent } from '../components/revenue-tab.component';

/**
 * Trung tâm báo cáo (đặc tả 10): chọn kỳ chung; tab tài chính theo `reports:view_financial`, tab vận hành
 * (10-C: Tuân thủ deadline M6, Hợp đồng M7, Khách hàng M8; 10-E: Đánh giá năng lực M9) theo
 * `reports:view_operations`.
 */
@Component({
  selector: 'app-reports-page',
  providers: [ReportContext],
  imports: [
    FormsModule,
    NzDatePickerModule,
    NzTabsModule,
    PageHeaderComponent,
    CanDirective,
    RevenueTabComponent,
    ReceivablesPanel,
    ReconciliationPanel,
    DeadlineComplianceTabComponent,
    ContractsReportTabComponent,
    CustomersReportTabComponent,
    CapabilityTabComponent,
  ],
  template: `
    <app-page-header title="Báo cáo" subtitle="Số liệu trong phạm vi dữ liệu bạn được xem">
      <nz-range-picker
        [ngModel]="range()"
        (ngModelChange)="onRangeChange($event)"
        nzFormat="dd/MM/yyyy"
        [nzAllowClear]="false"
      />
    </app-page-header>
    <div class="panel">
      <nz-tabs [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="tabIndex.set($event)">
        <nz-tab nzTitle="Doanh thu" *appCan="'reports:view_financial'">
          <ng-template nz-tab>
            <app-revenue-tab [from]="from()" [to]="to()" />
          </ng-template>
        </nz-tab>
        <!-- 10-D: Công nợ và Hoá đơn dùng lại màn hình 07 / 08 (cùng số, cùng Excel), không tính lại. -->
        @if (canReceivables()) {
          <nz-tab nzTitle="Công nợ">
            <ng-template nz-tab><app-receivables-panel /></ng-template>
          </nz-tab>
        }
        @if (canInvoices()) {
          <nz-tab nzTitle="Hoá đơn">
            <ng-template nz-tab><app-reconciliation-panel /></ng-template>
          </nz-tab>
        }
        <nz-tab nzTitle="Tuân thủ deadline" *appCan="'reports:view_operations'">
          <ng-template nz-tab>
            <app-deadline-compliance-tab [from]="from()" [to]="to()" />
          </ng-template>
        </nz-tab>
        <nz-tab nzTitle="Hợp đồng" *appCan="'reports:view_operations'">
          <ng-template nz-tab>
            <app-contracts-report-tab [from]="from()" [to]="to()" />
          </ng-template>
        </nz-tab>
        <nz-tab nzTitle="Khách hàng" *appCan="'reports:view_operations'">
          <ng-template nz-tab>
            <app-customers-report-tab [from]="from()" [to]="to()" />
          </ng-template>
        </nz-tab>
        <nz-tab nzTitle="Đánh giá năng lực" *appCan="'reports:view_operations'">
          <ng-template nz-tab>
            <app-capability-tab [from]="from()" [to]="to()" />
          </ng-template>
        </nz-tab>
      </nz-tabs>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly savedFilters = inject(SavedFiltersApi);
  private readonly message = inject(NzMessageService);
  private readonly context = inject(ReportContext);
  private readonly query = toSignal(this.route.queryParamMap);

  protected readonly canReceivables = computed(
    () => this.auth.can('reports:view_financial') && this.auth.can('payments:view'),
  );
  protected readonly canInvoices = computed(
    () => this.auth.can('reports:view_financial') && this.auth.can('invoices:view'),
  );
  protected readonly range = this.context.range;
  protected readonly from = this.context.from;
  protected readonly to = this.context.to;
  protected readonly tabIndex = signal(0);

  constructor() {
    // 10-F (M12): link trong thông báo định kỳ mở đúng tab, bộ lọc và kỳ của lượt gửi.
    effect(() => {
      const q = this.query();
      const id = q?.get('savedFilter');
      const from = q?.get('from');
      const to = q?.get('to');
      if (id && from && to) void this.openScheduled(id, from, to);
    });
  }

  protected onRangeChange(value: Date[] | null): void {
    this.context.setRange(value);
  }

  /** Thứ tự tab đang hiện, khớp mẫu ở trên. */
  private visibleTabs(): (ReportKey | 'other')[] {
    return [
      ...(this.auth.can('reports:view_financial') ? (['revenue'] as const) : []),
      ...(this.canReceivables() ? (['other'] as const) : []),
      ...(this.canInvoices() ? (['other'] as const) : []),
      ...(this.auth.can('reports:view_operations')
        ? (['deadline-compliance', 'contracts', 'customers', 'capability'] as const)
        : []),
    ];
  }

  private async openScheduled(id: string, from: string, to: string): Promise<void> {
    try {
      const filter = await firstValueFrom(this.savedFilters.get(id));
      const index = this.visibleTabs().indexOf(filter.report);
      if (index >= 0) this.tabIndex.set(index);
      this.context.scheduled.set({ filter, from, to });
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }
}
