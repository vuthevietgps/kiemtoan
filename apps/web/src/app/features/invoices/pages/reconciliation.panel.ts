import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { errorMessage } from '../../../core/api/api';
import { CanDirective } from '../../../shared/directives/can.directive';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { toDateKey } from '../../../shared/utils/date-key';
import { saveFile } from '../../deadlines/save-file';
import { ReconciliationStore } from '../data-access/reconciliation.store';
import { RECONCILIATION_TEXT } from '../invoices.text';

/**
 * Đối chiếu thu – xuất (08-D, K8): ô đếm đã thu chưa xuất / đã xuất chưa thu / chờ xuất, bảng theo HĐ
 * (đã thu đã duyệt, đã xuất hiệu lực gồm VAT), lọc đến ngày, chỉ HĐ chênh lệch, xuất Excel.
 */
@Component({
  selector: 'app-reconciliation-panel',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzIconModule,
    NzInputModule,
    NzTableModule,
    CanDirective,
    VndPipe,
  ],
  providers: [ReconciliationStore],
  template: `
    <div class="filters">
      <input
        nz-input
        class="search"
        [placeholder]="text.search"
        [ngModel]="search()"
        (ngModelChange)="search.set($event)"
        (keyup.enter)="store.setQuery({ search: search().trim() })"
      />
      <nz-date-picker
        nzFormat="dd/MM/yyyy"
        [nzPlaceHolder]="text.asOf"
        [ngModel]="asOf()"
        (ngModelChange)="setAsOf($event)"
      />
      <label
        nz-checkbox
        [ngModel]="store.query().mismatchOnly"
        (ngModelChange)="store.setQuery({ mismatchOnly: $event })"
      >
        {{ text.mismatchOnly }}
      </label>
      <button nz-button type="button" *appCan="'invoices:export'" (click)="export()">
        <nz-icon nzType="download" /> {{ text.export }}
      </button>
    </div>
    @if (store.error()) {
      <nz-alert class="notice" nzType="error" nzShowIcon [nzMessage]="store.error()" />
    }
    @if (store.data(); as d) {
      <div class="cards">
        <div class="card warn">
          <span>{{ text.paidNotInvoiced }}</span
          ><b>{{ d.summary.paidNotInvoiced | vnd }}</b>
        </div>
        <div class="card danger">
          <span>{{ text.invoicedNotPaid }}</span
          ><b>{{ d.summary.invoicedNotPaid | vnd }}</b>
        </div>
        <div class="card muted">
          <span>{{ text.requested }}</span
          ><b>{{ d.summary.requested | vnd }}</b>
        </div>
      </div>
    }
    <nz-table
      [nzData]="store.data()?.items ?? []"
      [nzLoading]="store.loading()"
      [nzShowPagination]="false"
      [nzScroll]="{ x: '1100px' }"
      [nzNoResult]="text.empty"
      nzSize="middle"
    >
      <thead>
        <tr>
          <th nzWidth="130px">{{ text.contract }}</th>
          <th>{{ text.customer }}</th>
          <th nzWidth="130px" class="text-right">{{ text.paid }}</th>
          <th nzWidth="130px" class="text-right">{{ text.invoiced }}</th>
          <th nzWidth="130px" class="text-right">{{ text.requested }}</th>
          <th nzWidth="140px" class="text-right">{{ text.paidNotInvoiced }}</th>
          <th nzWidth="140px" class="text-right">{{ text.invoicedNotPaid }}</th>
        </tr>
      </thead>
      <tbody>
        @for (r of store.data()?.items ?? []; track r.contractId) {
          <tr>
            <td>
              <button type="button" class="link" (click)="openContract(r.contractId)">
                {{ r.code }}
              </button>
            </td>
            <td>
              {{ r.customer.name }}
              <div class="muted">{{ r.customer.taxCode }}</div>
            </td>
            <td class="text-right">{{ r.paid | vnd }}</td>
            <td class="text-right">{{ r.invoiced | vnd }}</td>
            <td class="text-right text-muted">{{ r.requested | vnd }}</td>
            <td class="text-right" [class.warn-text]="+r.paidNotInvoiced > 0">
              {{ r.paidNotInvoiced | vnd }}
            </td>
            <td class="text-right" [class.danger-text]="+r.invoicedNotPaid > 0">
              {{ r.invoicedNotPaid | vnd }}
            </td>
          </tr>
        }
      </tbody>
      @if (store.data(); as d) {
        @if (d.items.length) {
          <tfoot>
            <tr>
              <td colspan="2">
                <b>{{ text.totalRow(d.items.length) }}</b>
              </td>
              <td class="text-right">
                <b>{{ d.summary.paid | vnd }}</b>
              </td>
              <td class="text-right">
                <b>{{ d.summary.invoiced | vnd }}</b>
              </td>
              <td class="text-right">
                <b>{{ d.summary.requested | vnd }}</b>
              </td>
              <td class="text-right">
                <b>{{ d.summary.paidNotInvoiced | vnd }}</b>
              </td>
              <td class="text-right">
                <b>{{ d.summary.invoicedNotPaid | vnd }}</b>
              </td>
            </tr>
          </tfoot>
        }
      }
    </nz-table>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin-bottom: 12px;
      .search {
        width: 280px;
        max-width: 100%;
      }
    }
    .notice {
      margin-bottom: 12px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border: 1px solid #f0f0f0;
      border-left: 4px solid #8c8c8c;
      border-radius: 6px;
      min-width: 0;
      span {
        color: rgba(0, 0, 0, 0.55);
      }
      b {
        font-size: 16px;
        word-break: break-word;
      }
    }
    .card.warn {
      border-left-color: #fa8c16;
    }
    .card.danger {
      border-left-color: #cf1322;
    }
    .warn-text {
      color: #d46b08;
    }
    .danger-text {
      color: #cf1322;
    }
    .muted {
      color: rgba(0, 0, 0, 0.45);
      font-size: 12px;
    }
    .link {
      padding: 0;
      border: 0;
      background: none;
      color: #1677ff;
      cursor: pointer;
      font: inherit;
    }
    tfoot td {
      padding: 12px 8px;
      background: #f7f9fc;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReconciliationPanel implements OnInit {
  protected readonly store = inject(ReconciliationStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  protected readonly text = RECONCILIATION_TEXT;
  protected readonly search = signal('');
  protected readonly asOf = signal<Date | null>(null);

  ngOnInit(): void {
    void this.store.load();
  }

  protected setAsOf(date: Date | null): void {
    this.asOf.set(date);
    this.store.setQuery({ to: date ? toDateKey(date) : null });
  }

  protected openContract(id: string): void {
    void this.router.navigate(['/contracts', id]);
  }

  protected async export(): Promise<void> {
    try {
      saveFile(await firstValueFrom(this.store.exportFile()), 'doi-chieu-thu-xuat.xlsx');
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }
}
