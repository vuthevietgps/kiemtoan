import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { CanDirective } from '../../../shared/directives/can.directive';
import { currentYearRange, toDateParam } from '../../dashboard/data-access/format';
import { ComplianceTabComponent } from '../components/compliance-tab.component';
import { ReceivablesTabComponent } from '../components/receivables-tab.component';
import { RevenueTabComponent } from '../components/revenue-tab.component';
import { StaffPerformanceTabComponent } from '../components/staff-performance-tab.component';

@Component({
  selector: 'app-reports-page',
  imports: [
    FormsModule,
    NzDatePickerModule,
    NzTabsModule,
    PageHeaderComponent,
    CanDirective,
    RevenueTabComponent,
    ReceivablesTabComponent,
    ComplianceTabComponent,
    StaffPerformanceTabComponent,
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
      <nz-tabs>
        <nz-tab nzTitle="Doanh thu" *appCan="'reports:view_financial'">
          <ng-template nz-tab>
            <app-revenue-tab [from]="from()" [to]="to()" />
          </ng-template>
        </nz-tab>
        <nz-tab nzTitle="Công nợ" *appCan="'reports:view_financial'">
          <ng-template nz-tab><app-receivables-tab /></ng-template>
        </nz-tab>
        <nz-tab nzTitle="Tuân thủ deadline" *appCan="'reports:view_operations'">
          <ng-template nz-tab>
            <app-compliance-tab [from]="from()" [to]="to()" />
          </ng-template>
        </nz-tab>
        <nz-tab nzTitle="Hiệu suất nhân viên" *appCan="'reports:view_operations'">
          <ng-template nz-tab>
            <app-staff-performance-tab [from]="from()" [to]="to()" />
          </ng-template>
        </nz-tab>
      </nz-tabs>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  protected readonly range = signal<Date[]>(currentYearRange());
  protected readonly from = computed(() => toDateParam(this.range()[0]));
  protected readonly to = computed(() => toDateParam(this.range()[1]));

  protected onRangeChange(value: Date[] | null): void {
    this.range.set(value && value.length === 2 ? value : currentYearRange());
  }
}
