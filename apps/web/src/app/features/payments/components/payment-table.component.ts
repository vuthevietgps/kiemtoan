import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { PAYMENT_METHOD_LABELS } from '../../contracts/contract-labels';
import type { PaymentItem } from '../data-access/payments.api';
import { PAYMENT_STATE_COLORS, PAYMENT_STATE_LABELS, PAYMENTS_TEXT } from '../payments.text';

/** Bảng phiếu thu (tab Phiếu thu / Chờ duyệt); bấm dòng mở ngăn chi tiết. */
@Component({
  selector: 'app-payment-table',
  imports: [DatePipe, NzIconModule, NzTableModule, NzTagModule, VndPipe],
  template: `
    <nz-table
      #table
      [nzData]="items()"
      [nzLoading]="loading()"
      [nzFrontPagination]="false"
      [nzTotal]="total()"
      [nzPageIndex]="page()"
      [nzPageSize]="pageSize()"
      [nzScroll]="{ x: '1080px' }"
      [nzNoResult]="text.empty"
      nzSize="middle"
      (nzQueryParams)="onQueryParams($event)"
    >
      <thead>
        <tr>
          <th nzWidth="120px">{{ text.code }}</th>
          <th nzWidth="110px">{{ text.paidDate }}</th>
          <th nzWidth="130px">{{ text.contract }}</th>
          <th>{{ text.customer }}</th>
          <th nzWidth="150px" class="text-right">{{ text.amount }}</th>
          <th nzWidth="150px">{{ text.method }}</th>
          <th nzWidth="110px">{{ text.state }}</th>
          <th nzWidth="150px">{{ text.receivedBy }}</th>
        </tr>
      </thead>
      <tbody>
        @for (p of table.data; track p.id) {
          <tr class="clickable" (click)="opened.emit(p.id)">
            <td>
              <a>{{ p.code }}</a>
            </td>
            <td>{{ p.paidDate | date: 'dd/MM/yyyy' }}</td>
            <td>{{ p.contract.code }}</td>
            <td>{{ p.contract.customer.name }}</td>
            <td class="text-right">{{ p.amount | vnd }}</td>
            <td>
              {{ methodLabels[p.method] }}
              @if (p._count.documents) {
                <nz-icon nzType="paper-clip" [title]="text.documents" />
              }
            </td>
            <td>
              <nz-tag [nzColor]="colors[p.status]">{{ labels[p.status] }}</nz-tag>
            </td>
            <td>{{ p.receivedBy.fullName }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: `
    .clickable {
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentTableComponent {
  readonly items = input<PaymentItem[]>([]);
  readonly loading = input(false);
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly opened = output<string>();
  readonly pageChange = output<{ page: number; pageSize: number }>();

  protected readonly text = PAYMENTS_TEXT;
  protected readonly labels = PAYMENT_STATE_LABELS;
  protected readonly colors = PAYMENT_STATE_COLORS;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;

  protected onQueryParams(params: NzTableQueryParams): void {
    if (params.pageIndex === this.page() && params.pageSize === this.pageSize()) return;
    this.pageChange.emit({ page: params.pageIndex, pageSize: params.pageSize });
  }
}
