import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../../core/api/api';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { CustomerFormComponent } from '../../components/customer-form/customer-form.component';
import {
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_OPTIONS,
  CustomerStatus,
} from '../../customer-labels';
import { Customer, CustomerListItem, CustomersApi } from '../../data-access/customers.api';
import { CustomerImportPanel, downloadWorkbook } from '../customer-import.panel';
import { CustomerImportApi } from '../../data-access/customer-import.api';
import { IMPORT_TEXT } from '../../customer-import.text';
import { CUSTOMERS_TEXT } from '../../customers.text';
import { CustomersStore } from '../../data-access/customers.store';
import { CustomerInput } from '../../data-access/customers.api';
import { AuthService } from '../../../../core/auth/auth.service';
import { NzAlertModule } from 'ng-zorro-antd/alert';

@Component({
  selector: 'app-customer-list-page',
  imports: [
    FormsModule,
    RouterLink,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzModalModule,
    PageHeaderComponent,
    CanDirective,
    CustomerFormComponent,
    CustomerImportPanel,
    NzAlertModule,
  ],
  templateUrl: './customer-list.page.html',
  providers: [CustomersStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerListPage implements OnInit {
  private readonly api = inject(CustomersApi);
  protected readonly store = inject(CustomersStore);
  protected readonly text = CUSTOMERS_TEXT;
  private readonly auth = inject(AuthService);
  protected readonly loadError = signal('');
  protected ownerId: string | null = null;
  private readonly imports = inject(CustomerImportApi);
  protected readonly importText = IMPORT_TEXT;
  protected readonly importVisible = signal(false);
  protected readonly exporting = signal(false);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);

  protected readonly statusLabels = CUSTOMER_STATUS_LABELS;
  protected readonly statusColors = CUSTOMER_STATUS_COLORS;
  protected readonly statusOptions = CUSTOMER_STATUS_OPTIONS;

  protected readonly items = signal<CustomerListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly loading = signal(false);
  protected readonly formVisible = signal(false);

  protected search = '';
  protected status: CustomerStatus | null = null;

  ngOnInit(): void {
    if (this.auth.can('customers:update')) void this.store.loadOwners();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api
      .list({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search.trim(),
        status: this.status,
        ownerId: this.ownerId,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.loadError.set(errorMessage(err));
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

  protected onSaved(customer: Customer): void {
    this.formVisible.set(false);
    void this.router.navigate(['/customers', customer.id]);
  }

  protected export(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.imports.export({page: 1, pageSize: 100, search: this.search.trim(), status: this.status, ownerId: this.ownerId}).subscribe({
      next: blob => { downloadWorkbook(blob, 'customers.xlsx'); this.exporting.set(false); },
      error: (error: unknown) => { this.message.error(errorMessage(error)); this.exporting.set(false); },
    });
  }
  protected async save(input: CustomerInput) { const customer = await this.store.save(input); if (customer) this.onSaved(customer); }
}
