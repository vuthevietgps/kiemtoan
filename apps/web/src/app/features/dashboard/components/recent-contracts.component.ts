import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { RecentContract } from '../data-access/dashboard.api';
import { CONTRACT_STATUS } from '../data-access/format';

/** Bảng "Hợp đồng gần đây" (5 hợp đồng mới nhất). */
@Component({
  selector: 'app-recent-contracts',
  imports: [RouterLink, NzTableModule, NzTagModule, VndPipe],
  template: `
    <nz-table
      #table
      [nzData]="contracts()"
      [nzShowPagination]="false"
      [nzFrontPagination]="false"
      nzSize="small"
      [nzScroll]="{ x: '760px' }"
      nzNoResult="Chưa có hợp đồng"
    >
      <thead>
        <tr>
          <th>Mã HĐ</th>
          <th>Khách hàng</th>
          <th>Loại dịch vụ</th>
          @if (showPaid()) {
            <th class="text-right">Giá trị (chưa VAT)</th>
            <th class="text-right">Tổng thanh toán</th>
            <th class="text-right">Đã thu</th>
          }
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        @for (c of table.data; track c.id) {
          <tr>
            <td>
              <a [routerLink]="['/contracts', c.id]">{{ c.code }}</a>
            </td>
            <td>{{ c.customerName }}</td>
            <td>{{ c.serviceTypes.join(', ') }}</td>
            @if (showPaid()) {
              <td class="text-right">{{ c.subtotal | vnd }}</td>
              <td class="text-right">{{ c.total | vnd }}</td>
              <td class="text-right">{{ c.paidAmount | vnd }}</td>
            }
            <td>
              <nz-tag [nzColor]="status(c.status).color">{{ status(c.status).label }}</nz-tag>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentContractsComponent {
  readonly contracts = input.required<RecentContract[]>();
  readonly showPaid = input(true);

  protected status(code: string) {
    return CONTRACT_STATUS[code] ?? { label: code, color: 'default' };
  }
}
