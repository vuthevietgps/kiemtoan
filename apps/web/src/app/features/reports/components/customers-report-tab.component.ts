import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../core/api/api';
import { CustomersReport, OperationsReportsApi } from '../data-access/operations-reports.api';
import { vnDate } from '../data-access/print-report';
import { ReportToolbarComponent } from './report-toolbar.component';
import { StatTile, StatTilesComponent } from './stat-tiles.component';

type Item = CustomersReport['items'][number];
type Filter = 'NEW' | 'STOPPED' | 'START' | 'END' | 'RETAINED' | null;

const PICK: Record<Exclude<Filter, null>, (i: Item) => boolean> = {
  NEW: (i) => i.isNew,
  STOPPED: (i) => i.stopped,
  START: (i) => i.activeAtStart,
  END: (i) => i.activeAtEnd,
  RETAINED: (i) => i.retained,
};

/**
 * Báo cáo khách hàng (10-C, M8) — tính theo hợp đồng đã duyệt: khách mới, khách ngừng, tỷ lệ giữ chân
 * (có HĐ hiệu lực đầu kỳ và vẫn còn cuối kỳ); ô bấm để lọc; Excel / bản in.
 */
@Component({
  selector: 'app-customers-report-tab',
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
      note="Mới = HĐ đầu tiên duyệt trong kỳ; ngừng = HĐ cuối cùng kết thúc trong kỳ, không còn HĐ sau đó; giữ chân = có HĐ hiệu lực đầu kỳ và cuối kỳ."
      report="customers"
      fileName="bao-cao-khach-hang.xlsx"
      [download]="download"
      [printable]="printable()"
    />
    @if (report.error(); as err) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="message(err)" />
    }
    @if (report.value()) {
      <app-stat-tiles [tiles]="tiles()" [active]="filter()" (picked)="filter.set($any($event))" />
      <nz-table
        #list
        [nzData]="items()"
        [nzPageSize]="20"
        nzSize="small"
        [nzScroll]="{ x: '760px' }"
        nzNoResult="Không có khách hàng"
      >
        <thead>
          <tr>
            <th>Khách hàng</th>
            <th nzWidth="140px">Người phụ trách</th>
            <th nzWidth="120px">HĐ đầu tiên</th>
            <th nzWidth="110px">Ngừng từ</th>
            <th nzWidth="200px">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          @for (c of list.data; track c.id) {
            <tr>
              <td>
                <a [routerLink]="['/customers', c.id]">{{ c.name }}</a>
                <div class="muted">{{ c.taxCode }}</div>
              </td>
              <td>{{ c.ownerName }}</td>
              <td>{{ date(c.firstApprovedOn) }}</td>
              <td>{{ date(c.stoppedOn) }}</td>
              <td>
                @if (c.isNew) {
                  <nz-tag nzColor="blue">Mới</nz-tag>
                }
                @if (c.stopped) {
                  <nz-tag nzColor="red">Ngừng</nz-tag>
                }
                @if (c.retained) {
                  <nz-tag nzColor="green">Giữ được</nz-tag>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
  styles: `
    .muted {
      color: rgba(0, 0, 0, 0.45);
      font-size: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersReportTabComponent {
  private readonly api = inject(OperationsReportsApi);
  readonly from = input.required<string>();
  readonly to = input.required<string>();

  protected readonly message = errorMessage;
  protected readonly date = vnDate;
  protected readonly filter = signal<Filter>(null);
  protected readonly report = rxResource({
    params: () => ({ from: this.from(), to: this.to() }),
    stream: ({ params }) => this.api.customers(params),
  });
  protected readonly download = () =>
    this.api.exportFile('customers', { from: this.from(), to: this.to() });

  protected readonly tiles = computed((): StatTile[] => {
    const s = this.report.value()?.summary;
    if (!s) return [];
    return [
      { key: 'NEW', label: 'Khách mới', value: s.newCustomers, color: '#1f5fbf' },
      { key: 'STOPPED', label: 'Khách ngừng', value: s.stopped, color: '#e5534b' },
      { key: 'START', label: 'Có HĐ đầu kỳ', value: s.activeAtStart, color: '#8c8c8c' },
      { key: 'END', label: 'Còn HĐ cuối kỳ', value: s.activeAtEnd, color: '#14a3b8' },
      { key: 'RETAINED', label: 'Giữ được', value: s.retained, color: '#2bb673' },
      {
        key: null,
        label: 'Tỷ lệ giữ chân',
        value: s.retentionRate === null ? '—' : `${s.retentionRate}%`,
        color: '#7b61ff',
      },
    ];
  });

  protected readonly items = computed((): Item[] => {
    const rows = this.report.value()?.items ?? [];
    const f = this.filter();
    return f ? rows.filter(PICK[f]) : rows;
  });

  protected readonly printable = computed(() => {
    const r = this.report.value();
    if (!r) return null;
    return {
      title: 'Báo cáo khách hàng',
      period: { from: r.from, to: r.to },
      summary: this.tiles().map((t): [string, string | number] => [t.label, t.value]),
      headers: ['Khách hàng', 'MST', 'Người phụ trách', 'HĐ đầu tiên', 'Ngừng từ', 'Trạng thái'],
      rows: this.items().map((c) => [
        c.name,
        c.taxCode,
        c.ownerName ?? '',
        vnDate(c.firstApprovedOn),
        vnDate(c.stoppedOn),
        [c.isNew && 'Mới', c.stopped && 'Ngừng', c.retained && 'Giữ được']
          .filter(Boolean)
          .join(', '),
      ]),
    };
  });
}
