import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import type { OpenInstallment } from '../data-access/payments.api';
import type { CustomerReceivable } from '../data-access/receivables.store';
import { RECEIVABLE_AGING_LABELS, RECEIVABLES_TEXT } from '../payments.text';

const BUCKET_COLORS = { '0-30': 'gold', '31-60': 'orange', '61-90': 'volcano', '>90': 'red' };

/** Công nợ theo KH → HĐ → đợt (J12): dòng KH mở ra các HĐ và đợt còn nợ kèm tuổi nợ. */
@Component({
  selector: 'app-receivable-table',
  imports: [DatePipe, NzTableModule, NzTagModule, VndPipe],
  template: `
    <nz-table
      [nzData]="groups()"
      [nzLoading]="loading()"
      [nzShowPagination]="false"
      [nzScroll]="{ x: '760px' }"
      [nzNoResult]="text.empty"
      nzSize="middle"
    >
      <thead>
        <tr>
          <th nzWidth="48px"></th>
          <th>{{ text.customer }}</th>
          <th nzWidth="90px" class="text-right">{{ text.contracts }}</th>
          <th nzWidth="150px" class="text-right">{{ text.remaining }}</th>
          <th nzWidth="150px" class="text-right">{{ text.overdue }}</th>
          <th nzWidth="140px" class="text-right">{{ text.pending }}</th>
        </tr>
      </thead>
      <tbody>
        @for (g of groups(); track g.customer.id) {
          <tr>
            <td [nzExpand]="isOpen(g.customer.id)" (nzExpandChange)="toggle(g.customer.id)"></td>
            <td>
              <button type="button" class="link" (click)="openCustomer.emit(g.customer.id)">
                {{ g.customer.name }}
              </button>
            </td>
            <td class="text-right">{{ g.contracts.length }}</td>
            <td class="text-right"><b>{{ g.remaining | vnd }}</b></td>
            <td class="text-right" [class.danger]="g.overdueAmount > 0">{{ g.overdueAmount | vnd }}</td>
            <td class="text-right text-muted">{{ g.pendingAmount | vnd }}</td>
          </tr>
          <tr [nzExpand]="isOpen(g.customer.id)">
            @for (c of g.contracts; track c.contractId) {
              <div class="contract">
                <div class="head">
                  <button type="button" class="link" (click)="openContract.emit(c.contractId)">
                    {{ c.code }}
                  </button>
                  <span class="text-muted">{{ text.owner }}: {{ c.owner?.fullName ?? text.noOwner }}</span>
                  <span>{{ text.paid }} {{ c.paid | vnd }} / {{ c.total | vnd }}</span>
                  <b>{{ text.remaining }} {{ c.remaining | vnd }}</b>
                </div>
                @for (i of c.installments; track i.id) {
                  <div class="installment">
                    <span>{{ i.name }} · {{ i.awaitingMilestone ? text.expected : '' }}{{ i.dueDate | date: 'dd/MM/yyyy' }}</span>
                    <span class="state">
                      @if (i.bucket) {
                        <nz-tag [nzColor]="bucketColors[i.bucket]">
                          {{ text.overdueBy(i.overdueDays!) }} · {{ agingLabels[i.bucket] }}
                        </nz-tag>
                      } @else {
                        <nz-tag nzColor="blue">{{ dueLabel(i) }}</nz-tag>
                      }
                    </span>
                    <b>{{ i.remaining | vnd }}</b>
                  </div>
                }
              </div>
            }
          </tr>
        }
      </tbody>
      @if (groups().length && footer(); as f) {
        <tfoot>
          <tr>
            <td></td>
            <td><b>{{ text.totalRow(f.count) }}</b></td>
            <td></td>
            <td class="text-right"><b>{{ f.remaining | vnd }}</b></td>
            <td class="text-right"><b>{{ f.overdue | vnd }}</b></td>
            <td class="text-right"><b>{{ f.pending | vnd }}</b></td>
          </tr>
        </tfoot>
      }
    </nz-table>
  `,
  styles: `
    tfoot td {
      padding: 12px 8px;
      background: #f7f9fc;
    }
    .danger {
      color: #cf1322;
    }
    .link {
      padding: 0;
      border: 0;
      background: none;
      color: #1677ff;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .contract {
      padding: 8px 0;
      border-bottom: 1px dashed #e5e5e5;
    }
    .contract:last-child {
      border-bottom: 0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      align-items: baseline;
      margin-bottom: 4px;
    }
    .installment {
      display: grid;
      grid-template-columns: minmax(140px, 1fr) auto 140px;
      gap: 8px;
      align-items: center;
      padding: 2px 0 2px 16px;
      b {
        text-align: right;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivableTableComponent {
  readonly groups = input<CustomerReceivable[]>([]);
  readonly loading = input(false);
  readonly footer = input<{
    count: number;
    remaining: string;
    overdue: string;
    pending: string;
  } | null>(null);
  readonly openContract = output<string>();
  readonly openCustomer = output<string>();

  protected readonly text = RECEIVABLES_TEXT;
  protected readonly agingLabels = RECEIVABLE_AGING_LABELS;
  protected readonly bucketColors = BUCKET_COLORS;
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected isOpen(id: string): boolean {
    return this.expanded().has(id);
  }

  protected toggle(id: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected dueLabel(i: OpenInstallment): string {
    if (i.dueInDays === null) return this.text.awaitingReport(i.dueOffsetDays ?? 0);
    return i.dueInDays === 0 ? this.text.dueToday : this.text.dueIn(i.dueInDays);
  }
}
