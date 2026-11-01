import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { errorMessage } from '../../../core/api/api';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { CHART_COLORS, compactVnd } from '../../dashboard/data-access/format';
import {
  FinanceReportsApi,
  GROUP_OPTIONS,
  MEASURES,
  RevenueGroup,
  RevenueMeasuresReport,
} from '../data-access/finance-reports.api';
import { vnDate } from '../data-access/print-report';
import { ReportToolbarComponent } from './report-toolbar.component';

type Row = RevenueMeasuresReport['rows'][number];
type Details = RevenueMeasuresReport['details'];
const pct = (r: number | null) => (r === null ? '—' : `${r > 0 ? '+' : ''}${r}%`);

/**
 * Doanh thu (10-D, M4–M5): 3 thước đo song song (giá trị HĐ theo ngày duyệt, đã xuất hoá đơn, đã thu) theo
 * nhóm, so cùng kỳ năm trước; bấm cột biểu đồ / dòng để xem đúng các HĐ, hoá đơn, phiếu thu tạo nên số.
 */
@Component({
  selector: 'app-revenue-tab',
  imports: [
    FormsModule,
    RouterLink,
    NgxEchartsDirective,
    NzAlertModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    VndPipe,
    ReportToolbarComponent,
  ],
  templateUrl: './revenue-tab.component.html',
  styles: `
    .group {
      width: 240px;
      max-width: 100%;
      margin-bottom: 12px;
    }
    .chart {
      height: 300px;
      margin-bottom: 12px;
    }
    .muted {
      color: #6b7280;
      font-size: 12px;
    }
    .up {
      color: #16a34a;
    }
    .down {
      color: #dc2626;
    }
    tr.picked td {
      background: #e6f4ff;
    }
    tr.row {
      cursor: pointer;
    }
    h4 {
      margin: 16px 0 8px;
      color: #0f2a4a;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevenueTabComponent {
  private readonly api = inject(FinanceReportsApi);
  readonly from = input.required<string>();
  readonly to = input.required<string>();

  protected readonly options = GROUP_OPTIONS;
  protected readonly measures = MEASURES;
  protected readonly message = errorMessage;
  protected readonly pct = pct;
  protected readonly date = vnDate;
  protected readonly groupBy = signal<RevenueGroup>('serviceType');
  /** Nhóm đang xem chi tiết (bấm cột / dòng); null = tất cả. */
  protected readonly picked = signal<Row | null>(null);
  protected readonly report = rxResource({
    params: () => ({ from: this.from(), to: this.to(), groupBy: this.groupBy() }),
    stream: ({ params }) => this.api.revenue(params),
  });
  protected readonly download = () =>
    this.api.exportFile({ from: this.from(), to: this.to(), groupBy: this.groupBy() });

  protected readonly groupLabel = computed(
    () => GROUP_OPTIONS.find((o) => o.value === this.groupBy())!.label,
  );

  protected changeGroup(group: RevenueGroup): void {
    this.picked.set(null);
    this.groupBy.set(group);
  }

  /** 10-F: mở lại bộ lọc đã lưu. */
  protected applyFilter(params: Record<string, string>): void {
    this.changeGroup((params['groupBy'] as RevenueGroup) ?? 'serviceType');
  }

  protected pick(row: Row): void {
    this.picked.set(this.picked()?.key === row.key ? null : row);
  }

  protected readonly chart = computed<EChartsOption>(() => {
    const rows = this.report.value()?.rows ?? [];
    const split = this.groupBy() === 'serviceType';
    const shown = split ? MEASURES.slice(0, 1) : MEASURES;
    return {
      color: CHART_COLORS,
      tooltip: { trigger: 'axis', valueFormatter: (v) => compactVnd(Number(v)) },
      legend: { bottom: 0 },
      grid: { left: 8, right: 16, top: 16, bottom: 32, containLabel: true },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.name),
        axisLabel: { interval: 0, rotate: rows.length > 6 ? 30 : 0 },
      },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => compactVnd(v) } },
      series: shown.map((m) => ({
        name: m.label,
        type: 'bar' as const,
        barMaxWidth: 28,
        data: rows.map((r) => Number(r[m.key] ?? 0)),
      })),
    };
  });

  protected onChartClick(event: { dataIndex?: number }): void {
    const row = this.report.value()?.rows[event.dataIndex ?? -1];
    if (row) this.pick(row);
  }

  /** Chi tiết của nhóm đang chọn — khớp cách máy chủ gom nhóm. */
  protected readonly details = computed((): Details => {
    const all = this.report.value()?.details ?? { contracts: [], invoices: [], payments: [] };
    const row = this.picked();
    if (!row) return all;
    const group = this.groupBy();
    const match = (d: { customerId: string; ownerId: string; month: string }) =>
      group === 'customer'
        ? d.customerId === row.key
        : group === 'owner'
          ? d.ownerId === row.key
          : d.month === row.key;
    if (group === 'serviceType')
      return {
        contracts: all.contracts.filter((c) => c.serviceTypeIds.includes(row.key)),
        invoices: [],
        payments: [],
      };
    return {
      contracts: all.contracts.filter(match),
      invoices: all.invoices.filter(match),
      payments: all.payments.filter(match),
    };
  });

  protected readonly printable = computed(() => {
    const r = this.report.value();
    if (!r) return null;
    const money = (v: string | null) => (v === null ? '—' : compactVnd(Number(v)));
    return {
      title: 'Báo cáo doanh thu',
      period: { from: r.from, to: r.to },
      summary: MEASURES.map((m): [string, string] => [
        `${m.label} (${pct(r.totals.change[m.key])} so cùng kỳ)`,
        money(r.totals[m.key]),
      ]),
      headers: [
        GROUP_OPTIONS.find((o) => o.value === r.groupBy)!.label,
        'Số HĐ',
        ...MEASURES.map((m) => m.label),
      ],
      rows: r.rows.map((row) => [
        row.name,
        row.contracts,
        ...MEASURES.map((m) => money(row[m.key])),
      ]),
    };
  });
}
