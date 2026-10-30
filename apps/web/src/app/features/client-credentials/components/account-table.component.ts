import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CREDENTIAL_STATUS_COLORS,
  CREDENTIAL_STATUS_LABELS,
  CREDENTIAL_TYPE_LABELS,
} from '../../customers/customer-labels';
import { CREDENTIALS_TEXT, EXPIRY_WARNING_DAYS } from '../client-credentials.text';
import type { ClientCredential } from '../data-access/client-credentials.api';

/** Bảng tài khoản cổng (09-D): loại, tên đăng nhập, hạn, trạng thái; bấm dòng mở chi tiết. */
@Component({
  selector: 'app-account-table',
  imports: [DatePipe, NzTableModule, NzTagModule],
  template: `
    <nz-table
      #table
      [nzData]="items()"
      [nzLoading]="loading()"
      [nzFrontPagination]="false"
      [nzTotal]="total()"
      [nzPageIndex]="page()"
      [nzPageSize]="pageSize()"
      [nzScroll]="{ x: '820px' }"
      [nzNoResult]="text.emptyAccounts"
      nzSize="middle"
      (nzQueryParams)="changed($event)"
    >
      <thead>
        <tr>
          @if (showCustomer()) {
            <th nzWidth="220px">{{ text.customer }}</th>
          }
          <th nzWidth="190px">{{ text.type }}</th>
          <th>{{ text.username }}</th>
          <th nzWidth="140px">{{ text.expiresAt }}</th>
          <th nzWidth="150px">{{ text.status }}</th>
        </tr>
      </thead>
      <tbody>
        @for (c of table.data; track c.id) {
          <tr class="row" (click)="opened.emit(c.id)">
            @if (showCustomer()) {
              <td>{{ c.customer.name }}</td>
            }
            <td>
              {{ typeLabels[c.type] }}
              @if (c.label) {
                <div class="muted">{{ c.label }}</div>
              }
            </td>
            <td class="wrap">{{ c.username }}</td>
            <td>
              @if (c.expiresAt) {
                {{ c.expiresAt | date: 'dd/MM/yyyy' }}
                @if (warn(c)) {
                  <div class="warn">{{ text.daysLeft(c.daysToExpiry!) }}</div>
                }
              }
            </td>
            <td>
              <nz-tag [nzColor]="statusColors[c.status]">{{ statusLabels[c.status] }}</nz-tag>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: `
    .row {
      cursor: pointer;
    }
    .muted {
      color: rgba(0, 0, 0, 0.5);
      font-size: 12px;
    }
    .warn {
      color: #d4380d;
      font-weight: 500;
    }
    .wrap {
      word-break: break-all;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountTableComponent {
  readonly items = input<ClientCredential[]>([]);
  readonly loading = input(false);
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly showCustomer = input(true);
  readonly opened = output<string>();
  readonly pageChange = output<{ page: number; pageSize: number }>();

  protected readonly text = CREDENTIALS_TEXT;
  protected readonly typeLabels = CREDENTIAL_TYPE_LABELS;
  protected readonly statusLabels = CREDENTIAL_STATUS_LABELS;
  protected readonly statusColors = CREDENTIAL_STATUS_COLORS;

  protected warn(c: ClientCredential): boolean {
    return c.daysToExpiry !== null && c.daysToExpiry <= EXPIRY_WARNING_DAYS;
  }

  protected changed(params: NzTableQueryParams): void {
    if (params.pageIndex === this.page() && params.pageSize === this.pageSize()) return;
    this.pageChange.emit({ page: params.pageIndex, pageSize: params.pageSize });
  }
}
