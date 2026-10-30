import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CREDENTIALS_TEXT,
  CUSTODY_COLORS,
  CUSTODY_LABELS,
  EXPIRY_WARNING_DAYS,
  TOKEN_PROVIDER_LABELS,
} from '../client-credentials.text';
import type { ClientCredential } from '../data-access/client-credentials.api';

/** Bảng token chữ ký số (09-D, L2–L3): nhà cung cấp, serial, hạn, nơi giữ / người mượn, hạn trả. */
@Component({
  selector: 'app-token-table',
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
      [nzScroll]="{ x: '900px' }"
      [nzNoResult]="text.emptyTokens"
      nzSize="middle"
      (nzQueryParams)="changed($event)"
    >
      <thead>
        <tr>
          @if (showCustomer()) {
            <th nzWidth="220px">{{ text.customer }}</th>
          }
          <th>{{ text.provider }} / {{ text.serial }}</th>
          <th nzWidth="150px">{{ text.expiresAt }}</th>
          <th nzWidth="220px">{{ text.custody }}</th>
          <th nzWidth="130px">{{ text.loanDue }}</th>
        </tr>
      </thead>
      <tbody>
        @for (c of table.data; track c.id) {
          <tr class="row" (click)="opened.emit(c.id)">
            @if (showCustomer()) {
              <td>{{ c.customer.name }}</td>
            }
            <td>
              {{ c.provider ? providers[c.provider] : '—' }}
              <div class="serial">{{ c.serialNumber }}</div>
            </td>
            <td>
              {{ c.expiresAt | date: 'dd/MM/yyyy' }}
              @if (warn(c)) {
                <div class="warn">{{ text.daysLeft(c.daysToExpiry!) }}</div>
              }
            </td>
            <td>
              @if (c.custody) {
                <nz-tag [nzColor]="custodyColors[c.custody]">{{ custodyLabels[c.custody] }}</nz-tag>
              }
              <div class="muted">
                {{ c.custody === 'LOANED' ? c.holder?.fullName : c.storageLocation }}
              </div>
            </td>
            <td>
              @if (c.loanDueAt) {
                <span [class.warn]="c.loanOverdue">{{ c.loanDueAt | date: 'dd/MM/yyyy' }}</span>
                @if (c.loanOverdue) {
                  <div class="warn">{{ text.overdueBy }}</div>
                }
              }
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
    .serial {
      font-family: monospace;
      word-break: break-all;
    }
    .muted {
      color: rgba(0, 0, 0, 0.5);
      font-size: 12px;
    }
    .warn {
      color: #d4380d;
      font-weight: 500;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokenTableComponent {
  readonly items = input<ClientCredential[]>([]);
  readonly loading = input(false);
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly showCustomer = input(true);
  readonly opened = output<string>();
  readonly pageChange = output<{ page: number; pageSize: number }>();

  protected readonly text = CREDENTIALS_TEXT;
  protected readonly providers = TOKEN_PROVIDER_LABELS;
  protected readonly custodyLabels = CUSTODY_LABELS;
  protected readonly custodyColors = CUSTODY_COLORS;

  protected warn(c: ClientCredential): boolean {
    return c.daysToExpiry !== null && c.daysToExpiry <= EXPIRY_WARNING_DAYS;
  }

  protected changed(params: NzTableQueryParams): void {
    if (params.pageIndex === this.page() && params.pageSize === this.pageSize()) return;
    this.pageChange.emit({ page: params.pageIndex, pageSize: params.pageSize });
  }
}
