import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../../core/api/api';
import { AuthService } from '../../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { CredentialTableComponent } from '../../../client-credentials/components/credential-table/credential-table.component';
import { CustomerObligationsPanel } from '../../../deadlines/pages/customer-obligations.panel';
import { ReceivablesPanel } from '../../../payments/pages/receivables.panel';
import { CustomerDocumentsPanel } from '../customer-documents.panel';
import { CustomerFormComponent } from '../../components/customer-form/customer-form.component';
import {
  CONTRACT_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_STATUS_LABELS,
  TAX_PERIOD_LABELS,
  VAT_METHOD_LABELS,
  PIT_PERIOD_LABELS,
  ACCOUNTING_REGIME_LABELS,
} from '../../customer-labels';
import { CustomerDetail, CustomersApi } from '../../data-access/customers.api';
import { CustomerRelationshipsPanel } from '../customer-relationships.panel';
import { RELATIONSHIP_TEXT } from '../../customer-relationships.text';
import { CUSTOMERS_TEXT } from '../../customers.text';
import { CustomersStore } from '../../data-access/customers.store';
import { CustomerInput } from '../../data-access/customers.api';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-customer-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    VndPipe,
    NzTabsModule,
    NzDescriptionsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzPopconfirmModule,
    NzResultModule,
    NzSpinModule,
    PageHeaderComponent,
    CanDirective,
    CustomerFormComponent,
    CustomerDocumentsPanel,
    CredentialTableComponent,
    CustomerRelationshipsPanel,
    CustomerObligationsPanel,
    ReceivablesPanel,
    NzAlertModule,
  ],
  templateUrl: './customer-detail.page.html',
  providers: [CustomersStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailPage {
  private readonly api = inject(CustomersApi);
  protected readonly store = inject(CustomersStore);
  protected readonly text = CUSTOMERS_TEXT;
  protected readonly loadError = signal('');
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);

  /** Tham số :id của route (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly statusLabels = CUSTOMER_STATUS_LABELS;
  protected readonly relationshipText = RELATIONSHIP_TEXT;
  protected readonly statusColors = CUSTOMER_STATUS_COLORS;
  protected readonly taxPeriodLabels = TAX_PERIOD_LABELS;
  protected readonly vatMethodLabels = VAT_METHOD_LABELS;
  protected readonly pitPeriodLabels = PIT_PERIOD_LABELS;
  protected readonly regimeLabels = ACCOUNTING_REGIME_LABELS;
  protected readonly contractStatusLabels = CONTRACT_STATUS_LABELS;

  protected readonly customer = signal<CustomerDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly editing = signal(false);
  protected readonly canSeeCredentials = computed(() =>
    this.auth.permissions().has('client-credentials:view'),
  );
  protected readonly canSeeTasks = computed(() => this.auth.can('tasks:view'));
  protected readonly canSeeContracts = computed(() => this.auth.can('contracts:view'));
  protected readonly canSeeDocuments = computed(() =>
    this.auth.permissions().has('documents:view'),
  );
  /** 06-D2: tab Lịch báo cáo. */
  protected readonly canSeeObligations = computed(() => this.auth.can('deadlines:view'));
  /** 07-D1: khối công nợ KH (người có quyền thu tiền; tiền ẩn với người không có quyền tài chính). */
  protected readonly canSeeReceivables = computed(() => this.auth.can('payments:view'));

  constructor() {
    if (this.auth.can('customers:update')) void this.store.loadOwners();
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected load(id = this.id()): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.get(id).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.notFound.set(false);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.notFound.set(error instanceof HttpErrorResponse && error.status === 404);
        this.loadError.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected onSaved(): void {
    this.editing.set(false);
    this.load();
  }

  protected remove(): void {
    this.api.remove(this.id()).subscribe({
      next: () => {
        this.message.success(this.text.removed);
        void this.router.navigate(['/customers']);
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }
  protected async save(input: CustomerInput) { if (await this.store.save(input, this.id())) this.onSaved(); }
}
