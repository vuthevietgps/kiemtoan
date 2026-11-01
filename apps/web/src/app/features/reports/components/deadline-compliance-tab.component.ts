import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../core/api/api';
import {
  ComplianceOutcome,
  DeadlineComplianceReport,
  OperationsReportsApi,
} from '../data-access/operations-reports.api';
import { vnDate } from '../data-access/print-report';
import { ReportToolbarComponent } from './report-toolbar.component';
import { StatTilesComponent, StatTile } from './stat-tiles.component';

type Item = DeadlineComplianceReport['items'][number];
type Filter = ComplianceOutcome | 'CLIENT' | null;

const OUTCOME: Record<ComplianceOutcome, { label: string; color: string }> = {
  ON_TIME: { label: 'Đúng hạn', color: 'green' },
  LATE: { label: 'Trễ', color: 'orange' },
  OVERDUE: { label: 'Quá hạn chưa nộp', color: 'red' },
  NOT_DUE: { label: 'Chưa đến hạn', color: 'default' },
};
const rate = (r: number | null) => (r === null ? '—' : `${r}%`);

/**
 * Tuân thủ deadline (10-C, M6): kỳ báo cáo pháp lý của KH (06) và việc pháp lý không gắn nghĩa vụ; ô tổng
 * hợp bấm để lọc danh sách chi tiết; theo tháng của hạn và theo khách hàng; Excel / bản in.
 */
@Component({
  selector: 'app-deadline-compliance-tab',
  imports: [
    RouterLink,
    NzAlertModule,
    NzTableModule,
    NzTagModule,
    ReportToolbarComponent,
    StatTilesComponent,
  ],
  template: `
    <app-report-toolbar
      note="Hạn trong kỳ; đúng hạn = ngày nộp / hoàn thành không sau hạn. Tỷ lệ không tính kỳ chưa đến hạn."
      report="deadline-compliance"
      fileName="tuan-thu-deadline.xlsx"
      [download]="download"
      [printable]="printable()"
    />
    @if (report.error(); as err) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="message(err)" />
    }
    @if (report.value(); as r) {
      <app-stat-tiles [tiles]="tiles()" [active]="filter()" (picked)="filter.set($any($event))" />
      <h4>Theo khách hàng</h4>
      <nz-table
        #byCustomer
        [nzData]="r.byCustomer"
        [nzPageSize]="10"
        nzSize="small"
        [nzScroll]="{ x: '640px' }"
        nzNoResult="Không có hạn trong kỳ"
      >
        <thead>
          <tr>
            <th>Khách hàng</th>
            <th class="text-right">Đúng hạn</th>
            <th class="text-right">Trễ</th>
            <th class="text-right">Quá hạn</th>
            <th class="text-right">Do khách</th>
            <th class="text-right">Tỷ lệ đúng hạn</th>
          </tr>
        </thead>
        <tbody>
          @for (c of byCustomer.data; track c.customerId) {
            <tr>
              <td>{{ c.name }}</td>
              <td class="text-right">{{ c.onTime }}</td>
              <td class="text-right">{{ c.late }}</td>
              <td class="text-right">{{ c.overdue }}</td>
              <td class="text-right">{{ c.clientDelay }}</td>
              <td class="text-right">{{ rate(c.onTimeRate) }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      <h4>Danh sách chi tiết ({{ items().length }})</h4>
      <nz-table
        #list
        [nzData]="items()"
        [nzPageSize]="20"
        nzSize="small"
        [nzScroll]="{ x: '760px' }"
        nzNoResult="Không có dòng nào"
      >
        <thead>
          <tr>
            <th>Khách hàng</th>
            <th>Báo cáo / việc</th>
            <th nzWidth="100px">Hạn</th>
            <th nzWidth="110px">Nộp / xong</th>
            <th nzWidth="170px">Kết quả</th>
          </tr>
        </thead>
        <tbody>
          @for (i of list.data; track i.kind + i.id) {
            <tr>
              <td>{{ i.customerName }}</td>
              <td>
                <a
                  [routerLink]="i.kind === 'TASK' ? '/tasks' : '/deadlines'"
                  [queryParams]="{ id: i.id }"
                  >{{ i.title }}</a
                >
              </td>
              <td>{{ date(i.dueDate) }}</td>
              <td>{{ date(i.doneOn) }}</td>
              <td>
                <nz-tag [nzColor]="outcome[i.outcome].color">
                  {{ outcome[i.outcome].label
                  }}{{ i.daysLate && i.outcome !== 'ON_TIME' ? ' ' + i.daysLate + ' ngày' : '' }}
                </nz-tag>
                @if (i.clientDelay) {
                  <nz-tag nzColor="purple">Do khách</nz-tag>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
  styles: `
    h4 {
      margin: 16px 0 8px;
      color: #0f2a4a;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadlineComplianceTabComponent {
  private readonly api = inject(OperationsReportsApi);
  readonly from = input.required<string>();
  readonly to = input.required<string>();

  protected readonly message = errorMessage;
  protected readonly outcome = OUTCOME;
  protected readonly rate = rate;
  protected readonly date = vnDate;
  protected readonly filter = signal<Filter>(null);
  protected readonly report = rxResource({
    params: () => ({ from: this.from(), to: this.to() }),
    stream: ({ params }) => this.api.deadlineCompliance(params),
  });
  protected readonly download = () =>
    this.api.exportFile('deadline-compliance', { from: this.from(), to: this.to() });

  protected readonly tiles = computed((): StatTile[] => {
    const s = this.report.value()?.summary;
    if (!s) return [];
    return [
      { key: 'ON_TIME', label: 'Đúng hạn', value: s.onTime, color: '#2bb673' },
      { key: 'LATE', label: 'Trễ', value: s.late, color: '#f5a623' },
      { key: 'OVERDUE', label: 'Quá hạn chưa nộp', value: s.overdue, color: '#e5534b' },
      { key: 'NOT_DUE', label: 'Chưa đến hạn', value: s.notDue, color: '#8c8c8c' },
      { key: 'CLIENT', label: 'Trễ / quá hạn do khách', value: s.clientDelay, color: '#7b61ff' },
      { key: null, label: 'Tỷ lệ đúng hạn', value: rate(s.onTimeRate), color: '#1f5fbf' },
    ];
  });

  protected readonly items = computed((): Item[] => {
    const rows = this.report.value()?.items ?? [];
    const f = this.filter();
    if (!f) return rows;
    return rows.filter((i) =>
      f === 'CLIENT' ? i.clientDelay && i.outcome !== 'ON_TIME' : i.outcome === f,
    );
  });

  protected readonly printable = computed(() => {
    const r = this.report.value();
    if (!r) return null;
    return {
      title: 'Báo cáo tuân thủ deadline',
      period: { from: r.from, to: r.to },
      summary: this.tiles().map((t): [string, string | number] => [t.label, t.value]),
      headers: ['Khách hàng', 'Báo cáo / việc', 'Hạn', 'Nộp / xong', 'Kết quả'],
      rows: this.items().map((i) => [
        i.customerName,
        i.title,
        vnDate(i.dueDate),
        vnDate(i.doneOn),
        OUTCOME[i.outcome].label + (i.clientDelay ? ' (do khách)' : ''),
      ]),
    };
  });
}
