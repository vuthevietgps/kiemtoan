import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { CanDirective } from '../../../shared/directives/can.directive';
import { toDateKey } from '../../../shared/utils/date-key';
import { INVOICE_STATUS_OPTIONS, InvoiceStatus } from '../../contracts/contract-labels';
import { saveFile } from '../../deadlines/save-file';
import { InvoiceBuyerFormComponent } from '../components/invoice-buyer-form.component';
import { InvoiceDrawerComponent } from '../components/invoice-drawer.component';
import { InvoiceRecordFormComponent } from '../components/invoice-record-form.component';
import { InvoiceTableComponent } from '../components/invoice-table.component';
import { ReconciliationPanel } from './reconciliation.panel';
import { InvoiceBuyer, InvoiceRecordInput } from '../data-access/invoices.api';
import { DEFAULT_QUERY, InvoicesStore } from '../data-access/invoices.store';
import {
  INVOICE_KIND_LABELS,
  INVOICES_TEXT,
  InvoiceKind,
  RECONCILIATION_TEXT,
  RecordMode,
} from '../invoices.text';

const TAB_QUEUE = 0;

/**
 * Hoá đơn (08-C, 08-D; đặc tả 08 "Màn hình"): tab Chờ xuất (hàng chờ của kế toán), Sổ hoá đơn (lọc trạng
 * thái/loại/kỳ, xuất Excel) và Đối chiếu thu – xuất; ngăn chi tiết với ghi nhận xuất, điều chỉnh, thay thế, huỷ đề nghị. `?id=` mở thẳng.
 */
@Component({
  selector: 'app-invoice-list-page',
  imports: [
    FormsModule,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzDatePickerModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTabsModule,
    PageHeaderComponent,
    InvoiceBuyerFormComponent,
    InvoiceDrawerComponent,
    InvoiceRecordFormComponent,
    InvoiceTableComponent,
    ReconciliationPanel,
    CanDirective,
    NzIconModule,
  ],
  providers: [InvoicesStore],
  templateUrl: './invoice-list.page.html',
  styleUrl: './invoice-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceListPage {
  protected readonly store = inject(InvoicesStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);

  protected readonly text = INVOICES_TEXT;
  protected readonly reconciliationText = RECONCILIATION_TEXT;
  protected readonly statuses = INVOICE_STATUS_OPTIONS;
  protected readonly kinds = (Object.keys(INVOICE_KIND_LABELS) as InvoiceKind[]).map((value) => ({
    value,
    label: INVOICE_KIND_LABELS[value],
  }));
  protected readonly tab = signal(TAB_QUEUE);
  protected readonly search = signal('');
  protected readonly range = signal<Date[]>([]);
  protected readonly ledgerStatus = signal<InvoiceStatus | null>(null);
  protected readonly canCreate = computed(() => this.auth.can('invoices:create'));
  protected readonly canUpdate = computed(() => this.auth.can('invoices:update'));
  protected readonly recording = signal<RecordMode | null>(null);
  protected readonly editingBuyer = signal(false);

  constructor() {
    this.store.setQuery({ status: 'REQUESTED' });
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) void this.store.open(id);
  }

  protected selectTab(index: number): void {
    this.tab.set(index);
    if (index === 2) return;
    this.store.setQuery({ status: index === TAB_QUEUE ? 'REQUESTED' : this.ledgerStatus() });
  }

  protected filterStatus(status: InvoiceStatus | null): void {
    this.ledgerStatus.set(status);
    this.store.setQuery({ status });
  }

  protected filterKind(kind: InvoiceKind | null): void {
    this.store.setQuery({ kind });
  }

  protected applyFilter(): void {
    const [from, to] = this.range();
    this.store.setQuery({
      search: this.search().trim(),
      from: from ? toDateKey(from) : null,
      to: to ? toDateKey(to) : null,
    });
  }

  protected reset(): void {
    this.search.set('');
    this.range.set([]);
    this.ledgerStatus.set(null);
    this.store.setQuery({
      ...DEFAULT_QUERY,
      status: this.tab() === TAB_QUEUE ? 'REQUESTED' : null,
    });
  }

  protected open(id: string): void {
    void this.store.open(id);
    void this.router.navigate([], { queryParams: { id }, replaceUrl: true });
  }

  protected close(): void {
    this.store.close();
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected openContract(id: string): void {
    void this.router.navigate(['/contracts', id]);
  }

  protected async record(input: InvoiceRecordInput): Promise<void> {
    const mode = this.recording();
    if (!mode) return;
    if (await this.store.act({ kind: mode, input })) {
      this.recording.set(null);
      this.message.success(this.text.done);
      const created = this.store.detail();
      if (created)
        void this.router.navigate([], { queryParams: { id: created.id }, replaceUrl: true });
    } else {
      this.message.error(this.store.actionError());
    }
  }

  protected async saveBuyer(buyer: InvoiceBuyer): Promise<void> {
    if (await this.store.act({ kind: 'buyer', buyer })) {
      this.editingBuyer.set(false);
      this.message.success(this.text.done);
    } else {
      this.message.error(this.store.actionError());
    }
  }

  protected async cancel(reason: string): Promise<void> {
    if (await this.store.act({ kind: 'cancel', reason })) this.message.success(this.text.done);
  }

  protected async exportLedger(): Promise<void> {
    try {
      saveFile(await firstValueFrom(this.store.exportInvoices()), 'so-hoa-don.xlsx');
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }

  protected async download(doc: { id: string; fileName: string }): Promise<void> {
    try {
      saveFile(await firstValueFrom(this.store.downloadDocument(doc.id)), doc.fileName);
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }
}
