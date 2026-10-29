import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../core/api/api';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { CanDirective } from '../../../shared/directives/can.directive';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_OPTIONS,
  InvoiceStatus,
} from '../../contracts/contract-labels';
import { InvoiceIssueFormComponent } from '../components/invoice-issue-form.component';
import { InvoiceItem, InvoicesApi } from '../data-access/invoices.api';

@Component({
  selector: 'app-invoice-list-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzModalModule,
    NzPopconfirmModule,
    PageHeaderComponent,
    CanDirective,
    VndPipe,
    InvoiceIssueFormComponent,
  ],
  templateUrl: './invoice-list.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceListPage implements OnInit {
  private readonly api = inject(InvoicesApi);
  private readonly message = inject(NzMessageService);

  protected readonly statusLabels = INVOICE_STATUS_LABELS;
  protected readonly statusColors = INVOICE_STATUS_COLORS;
  protected readonly statusOptions = INVOICE_STATUS_OPTIONS;

  protected readonly items = signal<InvoiceItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly loading = signal(false);
  protected readonly issuing = signal<InvoiceItem | null>(null);

  protected search = '';
  protected status: InvoiceStatus | null = null;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .list({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search.trim(),
        status: this.status,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.message.error(errorMessage(err));
        },
      });
  }

  protected applyFilter(): void {
    this.page.set(1);
    this.load();
  }

  protected onQueryParams(params: NzTableQueryParams): void {
    if (params.pageIndex === this.page() && params.pageSize === this.pageSize()) return;
    this.page.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.load();
  }

  protected onIssued(): void {
    this.issuing.set(null);
    this.load();
  }

  protected cancel(invoice: InvoiceItem): void {
    this.api.cancel(invoice.id).subscribe({
      next: () => {
        this.message.success('Đã huỷ hoá đơn');
        this.load();
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }
}
