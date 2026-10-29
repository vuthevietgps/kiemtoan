import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { errorMessage } from '../../../core/api/api';
import { CanDirective } from '../../../shared/directives/can.directive';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { moneyBarChart } from '../../dashboard/data-access/charts';
import { GROUP_BY_OPTIONS, ReportsApi, RevenueGroupBy } from '../data-access/reports.api';

@Component({
  selector: 'app-revenue-tab',
  imports: [
    FormsModule,
    NgxEchartsDirective,
    NzAlertModule,
    NzButtonModule,
    NzIconModule,
    NzSelectModule,
    NzTableModule,
    CanDirective,
    VndPipe,
  ],
  template: `
    <div class="filters">
      <nz-select [ngModel]="groupBy()" (ngModelChange)="groupBy.set($event)">
        @for (o of options; track o.value) {
          <nz-option [nzValue]="o.value" [nzLabel]="'Nhóm theo: ' + o.label" />
        }
      </nz-select>
      <a nz-button *appCan="'reports:export'" [href]="csvUrl()" download>
        <nz-icon nzType="download" /> Xuất CSV
      </a>
    </div>
    @if (report.error(); as err) {
      <nz-alert nzType="error" [nzMessage]="message(err)" nzShowIcon />
    }
    @if (report.value(); as r) {
      @if (r.rows.length) {
        <div echarts class="chart" [options]="chart()"></div>
      }
      <nz-table
        #t
        [nzData]="r.rows"
        [nzLoading]="report.isLoading()"
        [nzFrontPagination]="false"
        [nzShowPagination]="false"
        nzSize="small"
        [nzScroll]="{ x: '640px' }"
        nzNoResult="Không có doanh thu trong kỳ"
      >
        <thead>
          <tr>
            <th>{{ groupLabel() }}</th>
            <th class="text-right">Số hợp đồng</th>
            <th class="text-right">Doanh thu chưa VAT</th>
            <th class="text-right">Tổng thanh toán</th>
          </tr>
        </thead>
        <tbody>
          @for (row of t.data; track row.key) {
            <tr>
              <td>{{ row.name }}</td>
              <td class="text-right">{{ row.contracts }}</td>
              <td class="text-right">{{ row.subtotal | vnd }}</td>
              <td class="text-right">{{ row.total | vnd }}</td>
            </tr>
          }
          <tr class="total">
            <td>Tổng cộng</td>
            <td class="text-right">{{ r.totals.contracts }}</td>
            <td class="text-right">{{ r.totals.subtotal | vnd }}</td>
            <td class="text-right">{{ r.totals.total | vnd }}</td>
          </tr>
        </tbody>
      </nz-table>
    }
  `,
  styles: `
    .chart { height: 300px; margin-bottom: 12px; }
    .total td { font-weight: 600; background: #fafafa; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevenueTabComponent {
  private readonly api = inject(ReportsApi);
  readonly from = input.required<string>();
  readonly to = input.required<string>();

  protected readonly options = GROUP_BY_OPTIONS;
  protected readonly groupBy = signal<RevenueGroupBy>('serviceType');
  protected readonly message = errorMessage;

  protected readonly report = rxResource({
    params: () => ({ from: this.from(), to: this.to(), groupBy: this.groupBy() }),
    stream: ({ params }) => this.api.revenue(params),
  });

  protected readonly groupLabel = computed(
    () => GROUP_BY_OPTIONS.find((o) => o.value === this.groupBy())?.label ?? '',
  );

  protected readonly chart = computed(() => {
    const rows = this.report.value()?.rows ?? [];
    return moneyBarChart(
      rows.map((r) => r.name),
      rows.map((r) => Number(r.subtotal)),
      'Doanh thu chưa VAT',
    );
  });

  protected readonly csvUrl = computed(() =>
    this.api.csvUrl('revenue', { from: this.from(), to: this.to(), groupBy: this.groupBy() }),
  );
}
