import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../core/api/api';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import {
  ContractCategory,
  ContractsReport,
  OperationsReportsApi,
} from '../data-access/operations-reports.api';
import { vnDate } from '../data-access/print-report';
import { ReportToolbarComponent } from './report-toolbar.component';
import { StatTile, StatTilesComponent } from './stat-tiles.component';

type Item = ContractsReport['items'][number];

const CATEGORY: Record<ContractCategory, { label: string; color: string }> = {
  NEW: { label: 'Mới duyệt', color: 'blue' },
  ACTIVE: { label: 'Hiệu lực cuối kỳ', color: 'green' },
  EXPIRING: { label: 'Sắp hết hạn', color: 'orange' },
  ENDED: { label: 'Kết thúc trong kỳ', color: 'default' },
  RENEWED: { label: 'Đã tái ký', color: 'purple' },
};

/**
 * Báo cáo hợp đồng (10-C, M7): mới duyệt, hiệu lực cuối kỳ, sắp hết hạn, kết thúc / tái ký và tỷ lệ tái
 * ký; ô bấm để lọc; giá trị trước VAT chỉ hiện khi máy chủ trả (có quyền tài chính); Excel / bản in.
 */
@Component({
  selector: 'app-contracts-report-tab',
  imports: [
    RouterLink,
    NzAlertModule,
    NzTableModule,
    NzTagModule,
    VndPipe,
    ReportToolbarComponent,
    StatTilesComponent,
  ],
  template: `
    <app-report-toolbar
      [note]="note()"
      report="contracts"
      fileName="bao-cao-hop-dong.xlsx"
      [download]="download"
      [printable]="printable()"
    />
    @if (report.error(); as err) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="message(err)" />
    }
    @if (report.value(); as r) {
      <app-stat-tiles [tiles]="tiles()" [active]="filter()" (picked)="filter.set($any($event))" />
      <nz-table
        #list
        [nzData]="items()"
        [nzPageSize]="20"
        nzSize="small"
        [nzScroll]="{ x: '900px' }"
        nzNoResult="Không có hợp đồng"
      >
        <thead>
          <tr>
            <th nzWidth="130px">Mã HĐ</th>
            <th>Khách hàng</th>
            <th nzWidth="100px">Duyệt</th>
            <th nzWidth="100px">Kết thúc</th>
            <th>Nhóm</th>
            <th nzWidth="120px">Tái ký bằng</th>
            @if (money()) {
              <th nzWidth="140px" class="text-right">Trước VAT</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (c of list.data; track c.id) {
            <tr>
              <td>
                <a [routerLink]="['/contracts', c.id]">{{ c.code }}</a>
              </td>
              <td>{{ c.customerName }}</td>
              <td>{{ date(c.approvedOn) }}</td>
              <td>{{ date(c.endDate) }}</td>
              <td>
                @for (k of c.categories; track k) {
                  <nz-tag [nzColor]="category[k].color">{{ category[k].label }}</nz-tag>
                }
              </td>
              <td>{{ c.renewedBy.join(', ') }}</td>
              @if (money()) {
                <td class="text-right">{{ c.subtotal | vnd }}</td>
              }
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractsReportTabComponent {
  private readonly api = inject(OperationsReportsApi);
  readonly from = input.required<string>();
  readonly to = input.required<string>();

  protected readonly message = errorMessage;
  protected readonly category = CATEGORY;
  protected readonly date = vnDate;
  protected readonly filter = signal<ContractCategory | null>(null);
  protected readonly report = rxResource({
    params: () => ({ from: this.from(), to: this.to() }),
    stream: ({ params }) => this.api.contracts(params),
  });
  protected readonly download = () =>
    this.api.exportFile('contracts', { from: this.from(), to: this.to() });
  protected readonly money = computed(() =>
    (this.report.value()?.items ?? []).some((i) => i.subtotal !== undefined),
  );
  protected readonly note = computed(
    () =>
      `Mới duyệt = ngày duyệt trong kỳ; sắp hết hạn = kết thúc trong ${this.report.value()?.expiringDays ?? 30} ngày sau cuối kỳ, chưa tái ký; tỷ lệ tái ký = đã tái ký / kết thúc trong kỳ.`,
  );

  protected readonly tiles = computed((): StatTile[] => {
    const s = this.report.value()?.summary;
    if (!s) return [];
    return [
      { key: 'NEW', label: 'Mới duyệt', value: s.newApproved, color: '#1f5fbf' },
      { key: 'ACTIVE', label: 'Hiệu lực cuối kỳ', value: s.active, color: '#2bb673' },
      { key: 'EXPIRING', label: 'Sắp hết hạn', value: s.expiring, color: '#f5a623' },
      { key: 'ENDED', label: 'Kết thúc trong kỳ', value: s.ended, color: '#8c8c8c' },
      { key: 'RENEWED', label: 'Đã tái ký', value: s.renewed, color: '#7b61ff' },
      {
        key: null,
        label: 'Tỷ lệ tái ký',
        value: s.renewalRate === null ? '—' : `${s.renewalRate}%`,
        color: '#14a3b8',
      },
    ];
  });

  protected readonly items = computed((): Item[] => {
    const rows = this.report.value()?.items ?? [];
    const f = this.filter();
    return f ? rows.filter((c) => c.categories.includes(f)) : rows;
  });

  protected readonly printable = computed(() => {
    const r = this.report.value();
    if (!r) return null;
    return {
      title: 'Báo cáo hợp đồng',
      period: { from: r.from, to: r.to },
      summary: this.tiles().map((t): [string, string | number] => [t.label, t.value]),
      headers: ['Mã HĐ', 'Khách hàng', 'Duyệt', 'Kết thúc', 'Nhóm', 'Tái ký bằng'],
      rows: this.items().map((c) => [
        c.code,
        c.customerName,
        vnDate(c.approvedOn),
        vnDate(c.endDate),
        c.categories.map((k) => CATEGORY[k].label).join(', '),
        c.renewedBy.join(', '),
      ]),
    };
  });
}
