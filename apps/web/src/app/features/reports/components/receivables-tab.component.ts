import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { errorMessage } from '../../../core/api/api';
import { CanDirective } from '../../../shared/directives/can.directive';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { ReportsApi } from '../data-access/reports.api';

/** Công nợ theo khách hàng tại thời điểm hiện tại (không phụ thuộc khoảng ngày). */
@Component({
  selector: 'app-receivables-tab',
  imports: [NzAlertModule, NzButtonModule, NzIconModule, NzTableModule, CanDirective, VndPipe],
  template: `
    <div class="filters">
      <span class="text-muted">Số liệu tính đến hôm nay, quá hạn theo các đợt thanh toán đã tới hạn.</span>
      <a nz-button *appCan="'reports:export'" [href]="csvUrl()" download>
        <nz-icon nzType="download" /> Xuất CSV
      </a>
    </div>
    @if (report.error(); as err) {
      <nz-alert nzType="error" [nzMessage]="message(err)" nzShowIcon />
    }
    <nz-table
      #t
      [nzData]="report.value()?.rows ?? []"
      [nzLoading]="report.isLoading()"
      [nzPageSize]="20"
      nzSize="small"
      [nzScroll]="{ x: '820px' }"
      nzNoResult="Không có công nợ"
    >
      <thead>
        <tr>
          <th>Khách hàng</th>
          <th>Mã số thuế</th>
          <th class="text-right">Số HĐ</th>
          <th class="text-right">Tổng phải thu</th>
          <th class="text-right">Đã thu</th>
          <th class="text-right">Còn lại</th>
          <th class="text-right">Quá hạn</th>
        </tr>
      </thead>
      <tbody>
        @for (row of t.data; track row.customerId) {
          <tr>
            <td>{{ row.customerName }}</td>
            <td>{{ row.taxCode }}</td>
            <td class="text-right">{{ row.contracts }}</td>
            <td class="text-right">{{ row.total | vnd }}</td>
            <td class="text-right">{{ row.paid | vnd }}</td>
            <td class="text-right">{{ row.remaining | vnd }}</td>
            <td class="text-right" [class.overdue]="+row.overdue > 0">{{ row.overdue | vnd }}</td>
          </tr>
        }
        @if (report.value(); as r) {
          <tr class="total">
            <td colspan="3">Tổng cộng</td>
            <td class="text-right">{{ r.totals.total | vnd }}</td>
            <td class="text-right">{{ r.totals.paid | vnd }}</td>
            <td class="text-right">{{ r.totals.remaining | vnd }}</td>
            <td class="text-right">{{ r.totals.overdue | vnd }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: `
    .filters { justify-content: space-between; align-items: center; }
    .overdue { color: #dc2626; font-weight: 600; }
    .total td { font-weight: 600; background: #fafafa; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivablesTabComponent {
  private readonly api = inject(ReportsApi);
  protected readonly message = errorMessage;
  protected readonly report = rxResource({ stream: () => this.api.receivables() });
  protected readonly csvUrl = computed(() => this.api.csvUrl('receivables', {}));
}
