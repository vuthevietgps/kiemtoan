import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { errorMessage } from '../../../core/api/api';
import { CanDirective } from '../../../shared/directives/can.directive';
import { saveFile } from '../../deadlines/save-file';
import { ReceivableSummaryComponent } from '../components/receivable-summary.component';
import { ReceivableTableComponent } from '../components/receivable-table.component';
import { ReceivablesStore } from '../data-access/receivables.store';
import { RECEIVABLES_TEXT } from '../payments.text';

/**
 * Công nợ (07-D1, J12): ô đếm, thanh tuổi nợ, bảng KH → HĐ → đợt, xuất Excel. Dùng ở màn hình Thu tiền
 * và tab Công nợ của chi tiết KH (`customerId`).
 */
@Component({
  selector: 'app-receivables-panel',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    CanDirective,
    ReceivableSummaryComponent,
    ReceivableTableComponent,
  ],
  providers: [ReceivablesStore],
  template: `
    <div class="filters">
      @if (!customerId()) {
        <input
          nz-input
          class="search"
          [placeholder]="text.search"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="store.setQuery({ search: search().trim() })"
        />
      }
      <button nz-button type="button" *appCan="'payments:export'" (click)="export()">
        <nz-icon nzType="download" /> {{ text.export }}
      </button>
    </div>
    @if (store.error()) {
      <nz-alert class="notice" nzType="error" nzShowIcon [nzMessage]="store.error()" />
    }
    <app-receivable-summary [summary]="store.data()?.summary ?? null" />
    <app-receivable-table
      [groups]="store.groups()"
      [loading]="store.loading()"
      [footer]="footer()"
      (openContract)="openContract($event)"
      (openCustomer)="openCustomer($event)"
    />
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      .search {
        width: 300px;
        max-width: 100%;
      }
    }
    .notice {
      margin-bottom: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivablesPanel implements OnInit {
  readonly customerId = input<string | null>(null);

  protected readonly store = inject(ReceivablesStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  protected readonly text = RECEIVABLES_TEXT;
  protected readonly search = signal('');
  protected readonly footer = computed(() => {
    const d = this.store.data();
    return d
      ? {
          count: d.items.length,
          remaining: d.summary.remaining,
          overdue: d.summary.overdueAmount,
          pending: d.summary.pendingAmount,
        }
      : null;
  });

  ngOnInit(): void {
    this.store.setQuery({ customerId: this.customerId() });
  }

  protected openContract(id: string): void {
    void this.router.navigate(['/contracts', id]);
  }

  protected openCustomer(id: string): void {
    if (id !== this.customerId()) void this.router.navigate(['/customers', id]);
  }

  protected async export(): Promise<void> {
    try {
      saveFile(await firstValueFrom(this.store.exportReceivables()), 'cong-no.xlsx');
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }
}
