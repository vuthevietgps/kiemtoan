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
import { ContractDetail, ContractsApi } from '../../contracts/data-access/contracts.api';
import { saveFile } from '../../deadlines/save-file';
import { PaymentDrawerComponent } from '../components/payment-drawer.component';
import { PaymentFormComponent, PaymentFormValue } from '../components/payment-form.component';
import { PaymentTableComponent } from '../components/payment-table.component';
import { PaymentDetail } from '../data-access/payments.api';
import { DueInstallmentsPanel } from './due-installments.panel';
import { ReceivablesPanel } from './receivables.panel';
import { DEFAULT_QUERY, PaymentAction, PaymentsStore } from '../data-access/payments.store';
import {
  PAYMENT_STATE_OPTIONS,
  PAYMENTS_TEXT,
  PaymentState,
  RECEIVABLES_TEXT,
} from '../payments.text';

const TAB_PENDING = 1;

/**
 * Thu tiền (07-C, 07-D1; đặc tả 07 "Màn hình"): tab Phiếu thu (lọc trạng thái/kỳ, xuất Excel), Chờ duyệt
 * (hàng chờ của người duyệt), Công nợ (tuổi nợ KH → HĐ → đợt), Sắp đến hạn / Quá hạn; ngăn chi tiết
 * với thao tác vòng đời. `?id=` mở thẳng một phiếu.
 */
@Component({
  selector: 'app-payments-page',
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
    PaymentDrawerComponent,
    PaymentFormComponent,
    PaymentTableComponent,
    CanDirective,
    DueInstallmentsPanel,
    NzIconModule,
    ReceivablesPanel,
  ],
  providers: [PaymentsStore],
  templateUrl: './payments.page.html',
  styleUrl: './payments.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsPage {
  protected readonly store = inject(PaymentsStore);
  private readonly auth = inject(AuthService);
  private readonly contractsApi = inject(ContractsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);

  protected readonly text = PAYMENTS_TEXT;
  protected readonly receivableText = RECEIVABLES_TEXT;
  protected readonly states = PAYMENT_STATE_OPTIONS;
  protected readonly tab = signal(0);
  protected readonly search = signal('');
  protected readonly range = signal<Date[]>([]);
  /** Trạng thái đã chọn ở tab Phiếu thu — giữ lại khi sang tab Chờ duyệt rồi quay về. */
  private listStatus: PaymentState | null = null;
  protected readonly userId = computed(() => this.auth.user()?.id ?? null);
  protected readonly canCreate = computed(() => this.auth.can('payments:create'));
  protected readonly canApprove = computed(() => this.auth.can('payments:approve'));
  protected readonly editing = signal<{ payment: PaymentDetail; contract: ContractDetail } | null>(
    null,
  );

  constructor() {
    void this.store.load();
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) void this.store.open(id);
  }

  protected selectTab(index: number): void {
    this.tab.set(index);
    if (index === TAB_PENDING) this.store.setQuery({ status: 'PENDING' });
    else if (index === 0) this.store.setQuery({ status: this.listStatus });
  }

  protected filterStatus(status: PaymentState | null): void {
    this.listStatus = status;
    this.store.setQuery({ status });
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
    this.listStatus = null;
    this.store.setQuery({ ...DEFAULT_QUERY, status: this.tab() === TAB_PENDING ? 'PENDING' : null });
  }

  protected open(id: string): void {
    void this.store.open(id);
    void this.router.navigate([], { queryParams: { id }, replaceUrl: true });
  }

  protected close(): void {
    this.store.close();
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected async act(action: PaymentAction): Promise<void> {
    if (await this.store.act(action)) this.message.success(this.text.done);
  }

  protected openContract(id: string): void {
    void this.router.navigate(['/contracts', id]);
  }

  protected async export(): Promise<void> {
    try {
      saveFile(await firstValueFrom(this.store.exportPayments()), 'phieu-thu.xlsx');
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

  /** Sửa phiếu Nháp / Trả lại: cần đợt và số còn phải thu của HĐ cho form. */
  protected async startEdit(payment: PaymentDetail): Promise<void> {
    try {
      const contract = await firstValueFrom(this.contractsApi.get(payment.contract.id));
      this.editing.set({ payment, contract });
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }

  protected async saveEdit(value: PaymentFormValue): Promise<void> {
    const current = this.editing();
    if (!current) return;
    try {
      const result = await this.store.save(value.input, {
        file: value.file,
        submit: value.submit,
        existing: current.payment,
      });
      this.editing.set(null);
      void this.store.load();
      if (result.submitError)
        this.message.warning(`${this.text.savedDraftOnly}: ${result.submitError}`);
      else this.message.success(this.text.saved);
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }
}
