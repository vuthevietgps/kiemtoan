import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import type { DueInstallment } from '../data-access/payments.api';
import { RECEIVABLES_TEXT } from '../payments.text';

/** Danh sách đợt sắp đến hạn / quá hạn: tình trạng hạn, số còn thiếu, lập phiếu từ đợt. */
@Component({
  selector: 'app-due-installment-table',
  imports: [DatePipe, NzButtonModule, NzTableModule, NzTagModule, NzTooltipModule, VndPipe],
  template: `
    <nz-table
      [nzData]="items()"
      [nzLoading]="loading()"
      [nzShowPagination]="false"
      [nzScroll]="{ x: '1190px' }"
      [nzNoResult]="text.emptyDue"
      nzSize="middle"
    >
      <thead>
        <tr>
          <th nzWidth="130px">{{ text.contract }}</th>
          <th nzWidth="200px">{{ text.customer }}</th>
          <th>{{ text.installment }}</th>
          <th nzWidth="110px">{{ text.dueDate }}</th>
          <th nzWidth="150px">{{ text.status }}</th>
          <th nzWidth="140px" class="text-right">{{ text.remaining }}</th>
          <th nzWidth="140px">{{ text.owner }}</th>
          <th nzWidth="200px"></th>
        </tr>
      </thead>
      <tbody>
        @for (i of items(); track i.id) {
          <tr>
            <td>
              <button type="button" class="link" (click)="openContract.emit(i.contract.id)">
                {{ i.contract.code }}
              </button>
            </td>
            <td>{{ i.customer.name }}</td>
            <td>{{ i.name }}</td>
            <td>{{ i.dueDate | date: 'dd/MM/yyyy' }}</td>
            <td>
              @if (i.overdueDays) {
                <nz-tag nzColor="red">{{ text.overdueBy(i.overdueDays) }}</nz-tag>
              } @else {
                <nz-tag nzColor="gold">{{ i.dueInDays === 0 ? text.dueToday : text.dueIn(i.dueInDays ?? 0) }}</nz-tag>
              }
              @if (+i.pendingAmount > 0) {
                <span
                  class="pending"
                  nz-tooltip
                  [nzTooltipTitle]="text.pendingHint + ': ' + (i.pendingAmount | vnd)"
                  >●</span
                >
              }
            </td>
            <td class="text-right"><b>{{ i.remaining | vnd }}</b></td>
            <td>{{ i.owner?.fullName ?? text.noOwner }}</td>
            <td>
              @if (canCreate()) {
                <div class="row-actions">
                  <button nz-button nzSize="small" type="button" (click)="collect.emit(i)">
                    {{ text.collect }}
                  </button>
                  <button nz-button nzSize="small" type="button" (click)="request.emit(i)">
                    {{ text.request }}
                  </button>
                </div>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: `
    .link {
      padding: 0;
      border: 0;
      background: none;
      color: #1677ff;
      cursor: pointer;
      font: inherit;
    }
    .row-actions {
      display: flex;
      gap: 6px;
    }
    .pending {
      color: #faad14;
      cursor: help;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DueInstallmentTableComponent {
  readonly items = input<DueInstallment[]>([]);
  readonly loading = input(false);
  readonly canCreate = input(false);
  readonly collect = output<DueInstallment>();
  /** 07-D3: đề nghị thanh toán cho đợt. */
  readonly request = output<DueInstallment>();
  readonly openContract = output<string>();

  protected readonly text = RECEIVABLES_TEXT;
}
