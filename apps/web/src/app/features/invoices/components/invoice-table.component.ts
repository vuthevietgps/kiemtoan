import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from '../../contracts/contract-labels';
import type { InvoiceItem } from '../data-access/invoices.api';
import { INVOICE_KIND_LABELS, INVOICES_TEXT } from '../invoices.text';

/** Bảng hoá đơn (tab Chờ xuất / Sổ hoá đơn); bấm dòng mở ngăn chi tiết. */
@Component({
  selector: 'app-invoice-table',
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
      [nzScroll]="{ x: '1180px' }"
      [nzNoResult]="text.empty"
      nzSize="middle"
      (nzQueryParams)="onQueryParams($event)"
    >
      <thead>
        <tr>
          <th nzWidth="170px">{{ text.identity }}</th>
          <th nzWidth="110px">{{ text.issueDate }}</th>
          <th nzWidth="130px">{{ text.contract }}</th>
          <th>{{ text.buyer }}</th>
          <th nzWidth="140px">{{ text.installments }}</th>
          <th nzWidth="140px" class="text-right">{{ text.total }}</th>
          <th nzWidth="110px">{{ text.kind }}</th>
          <th nzWidth="130px">{{ text.status }}</th>
        </tr>
      </thead>
      <tbody>
        @for (inv of table.data; track inv.id) {
          <tr class="clickable" (click)="opened.emit(inv.id)">
            <td>
              @if (inv.number) {
                <a>{{ inv.templateCode ?? '' }}{{ inv.symbol }} · {{ inv.number }}</a>
              } @else {
                <a class="muted">{{ text.notIssued }}</a>
              }
              @if (inv._count.documents) {
                <nz-icon nzType="paper-clip" />
              }
            </td>
            <td>{{ (inv.issueDate | date: 'dd/MM/yyyy') ?? '—' }}</td>
            <td>{{ inv.contract.code }}</td>
            <td>
              {{ inv.buyerName ?? inv.contract.customer.name }}
              <div class="muted">{{ inv.buyerTaxCode ?? inv.contract.customer.taxCode }}</div>
            </td>
            <td>{{ installmentNames(inv) }}</td>
            <td class="text-right" [class.negative]="+inv.total < 0">{{ inv.total | vnd }}</td>
            <td>{{ kindLabels[inv.kind] }}</td>
            <td>
              <nz-tag [nzColor]="statusColors[inv.status]">{{ statusLabels[inv.status] }}</nz-tag>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: `
    .clickable {
      cursor: pointer;
    }
    .muted {
      color: rgba(0, 0, 0, 0.45);
      font-size: 12px;
    }
    .negative {
      color: #cf1322;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceTableComponent {
  readonly items = input<InvoiceItem[]>([]);
  readonly loading = input(false);
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly opened = output<string>();
  readonly pageChange = output<{ page: number; pageSize: number }>();

  protected readonly text = INVOICES_TEXT;
  protected readonly statusLabels = INVOICE_STATUS_LABELS;
  protected readonly statusColors = INVOICE_STATUS_COLORS;
  protected readonly kindLabels = INVOICE_KIND_LABELS;

  protected installmentNames(inv: InvoiceItem): string {
    return inv.installments.map((i) => i.installment.name).join(', ') || '—';
  }

  protected onQueryParams(params: NzTableQueryParams): void {
    if (params.pageIndex === this.page() && params.pageSize === this.pageSize()) return;
    this.pageChange.emit({ page: params.pageIndex, pageSize: params.pageSize });
  }
}
