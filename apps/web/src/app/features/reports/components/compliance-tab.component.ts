import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { errorMessage } from '../../../core/api/api';
import { CanDirective } from '../../../shared/directives/can.directive';
import { ComplianceStat, ReportsApi } from '../data-access/reports.api';

/** Tuân thủ deadline: đúng hạn / trễ hạn / quá hạn chưa xong theo tháng (của hạn) và theo nhân viên. */
@Component({
  selector: 'app-compliance-tab',
  imports: [NgxEchartsDirective, NzAlertModule, NzButtonModule, NzIconModule, NzTableModule, CanDirective],
  template: `
    <div class="filters">
      <span class="text-muted">Việc có hạn trong kỳ; đúng hạn = ngày hoàn thành không sau hạn.</span>
      <a nz-button *appCan="'reports:export'" [href]="csvUrl()" download>
        <nz-icon nzType="download" /> Xuất CSV
      </a>
    </div>
    @if (report.error(); as err) {
      <nz-alert nzType="error" [nzMessage]="message(err)" nzShowIcon />
    }
    @if (report.value(); as r) {
      <p>
        Tổng: <b>{{ r.totals.onTime }}</b> đúng hạn, <b>{{ r.totals.late }}</b> trễ hạn,
        <b>{{ r.totals.overdueOpen }}</b> chưa xong đã quá hạn — tỷ lệ đúng hạn
        <b>{{ rate(r.totals) }}</b>
      </p>
      <div echarts class="chart" [options]="chart()"></div>
      <h4>Theo nhân viên</h4>
      <nz-table
        #t
        [nzData]="r.byStaff"
        [nzShowPagination]="false"
        [nzFrontPagination]="false"
        nzSize="small"
        [nzScroll]="{ x: '560px' }"
        nzNoResult="Không có công việc trong kỳ"
      >
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th class="text-right">Đúng hạn</th>
            <th class="text-right">Trễ hạn</th>
            <th class="text-right">Quá hạn chưa xong</th>
            <th class="text-right">Tỷ lệ đúng hạn</th>
          </tr>
        </thead>
        <tbody>
          @for (s of t.data; track s.userId) {
            <tr>
              <td>{{ s.name }}</td>
              <td class="text-right">{{ s.onTime }}</td>
              <td class="text-right">{{ s.late }}</td>
              <td class="text-right">{{ s.overdueOpen }}</td>
              <td class="text-right">{{ rate(s) }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
  styles: `
    .filters { justify-content: space-between; align-items: center; }
    .chart { height: 300px; margin-bottom: 12px; }
    h4 { color: #0f2a4a; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceTabComponent {
  private readonly api = inject(ReportsApi);
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  protected readonly message = errorMessage;

  protected readonly report = rxResource({
    params: () => ({ from: this.from(), to: this.to() }),
    stream: ({ params }) => this.api.taskCompliance(params),
  });

  protected readonly csvUrl = computed(() =>
    this.api.csvUrl('task-compliance', { from: this.from(), to: this.to() }),
  );

  protected readonly chart = computed<EChartsOption>(() => {
    const months = this.report.value()?.byMonth ?? [];
    const series = (name: string, color: string, pick: (m: ComplianceStat) => number) => ({
      name,
      type: 'bar' as const,
      stack: 'tasks',
      barMaxWidth: 36,
      itemStyle: { color },
      data: months.map(pick),
    });
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: 8, right: 16, top: 16, bottom: 32, containLabel: true },
      xAxis: { type: 'category', data: months.map((m) => m.month.split('-').reverse().join('/')) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        series('Đúng hạn', '#2bb673', (m) => m.onTime),
        series('Trễ hạn', '#f5a623', (m) => m.late),
        series('Quá hạn chưa xong', '#e5534b', (m) => m.overdueOpen),
      ],
    };
  });

  protected rate(stat: ComplianceStat): string {
    return stat.onTimeRate === null ? '—' : `${stat.onTimeRate}%`;
  }
}
