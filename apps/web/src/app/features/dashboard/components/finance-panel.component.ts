import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { donutChart, moneyBarChart } from '../data-access/charts';
import { FinanceData } from '../data-access/dashboard.api';
import { compactVnd } from '../data-access/format';
import { KpiCardComponent } from './kpi-card.component';
import { RecentContractsComponent } from './recent-contracts.component';

/**
 * Tab Tài chính (10-B; G 3.1, M1, M4, M5) — chỉ người có `finance:view`: giá trị HĐ duyệt trong kỳ
 * (trước / gồm VAT, so kỳ liền trước), số HĐ, dịch vụ, doanh thu theo loại dịch vụ, tình trạng dịch vụ,
 * tình hình thanh toán (đã thu theo phiếu Đã duyệt), HĐ gần đây.
 */
@Component({
  selector: 'app-finance-panel',
  imports: [NgxEchartsDirective, KpiCardComponent, RecentContractsComponent],
  template: `
    <section class="kpis">
      <app-kpi-card
        label="Doanh thu (chưa VAT)"
        icon="rise"
        color="#1f5fbf"
        [value]="compact(data().kpis.revenue.value)"
        [change]="data().kpis.revenue.changePercent"
        hint="Giá trị HĐ duyệt trong kỳ"
      />
      <app-kpi-card
        label="Tổng giá trị thanh toán"
        icon="wallet"
        color="#7b61ff"
        [value]="compact(data().kpis.totalPayable.value)"
        [change]="data().kpis.totalPayable.changePercent"
      />
      <app-kpi-card
        label="Tổng số hợp đồng"
        icon="file-text"
        color="#14a3b8"
        [value]="'' + data().kpis.contracts.total"
        [hint]="'+' + data().kpis.contracts.new + ' hợp đồng duyệt trong kỳ'"
      />
      <app-kpi-card
        label="Dịch vụ đã hoàn thành"
        icon="check-circle"
        color="#2bb673"
        [value]="data().kpis.servicesDone + '/' + data().kpis.servicesTotal"
        [progress]="servicePercent()"
      />
      <app-kpi-card
        label="Dịch vụ chưa hoàn thành"
        icon="clock-circle"
        color="#f5a623"
        [value]="'' + (data().kpis.servicesTotal - data().kpis.servicesDone)"
        hint="Của các HĐ duyệt trong kỳ"
      />
    </section>

    <section class="charts">
      <div class="panel wide">
        <h3>Doanh thu theo loại dịch vụ</h3>
        @if (data().revenueByServiceType.length) {
          <div echarts class="chart" [options]="revenueChart()"></div>
        } @else {
          <p class="empty">Chưa có doanh thu trong kỳ</p>
        }
      </div>
      <div class="panel">
        <h3>Tình trạng dịch vụ</h3>
        <div echarts class="chart" [options]="serviceChart()"></div>
      </div>
      <div class="panel">
        <h3>Tình hình thanh toán</h3>
        <div echarts class="chart" [options]="paymentChart()"></div>
      </div>
    </section>

    <div class="panel">
      <h3>Hợp đồng gần đây</h3>
      <app-recent-contracts [contracts]="data().recentContracts" [showPaid]="true" />
    </div>
  `,
  styleUrl: './finance-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancePanelComponent {
  readonly data = input.required<FinanceData>();
  protected readonly compact = compactVnd;

  protected readonly servicePercent = computed(() => {
    const k = this.data().kpis;
    return k.servicesTotal > 0 ? Math.round((k.servicesDone / k.servicesTotal) * 100) : 0;
  });

  protected readonly revenueChart = computed(() => {
    const rows = this.data().revenueByServiceType;
    return moneyBarChart(
      rows.map((r) => r.name),
      rows.map((r) => Number(r.amount)),
      'Doanh thu',
    );
  });

  protected readonly serviceChart = computed(() => {
    const s = this.data().serviceStatus;
    return donutChart(
      [
        { name: 'Đã hoàn thành', value: s.completed, color: '#2bb673' },
        { name: 'Chưa hoàn thành', value: s.notCompleted, color: '#f5a623' },
      ],
      String(s.completed + s.notCompleted),
    );
  });

  protected readonly paymentChart = computed(() => {
    const paid = Number(this.data().paymentStatus.paid);
    const remaining = Number(this.data().paymentStatus.remaining);
    return donutChart(
      [
        { name: 'Đã thu', value: paid, color: '#1f5fbf' },
        { name: 'Còn phải thu', value: remaining, color: '#e5534b' },
      ],
      compactVnd(paid + remaining),
      true,
    );
  });
}
