import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { BILLING_CYCLE_LABELS } from '../../../contracts/contract-labels';
import { ServiceFormComponent } from '../../components/service-form.component';
import { ServiceType, ServiceTypeFilter, ServiceTypeInput } from '../../data-access/service-catalog.api';
import { ServiceCatalogStore } from '../../data-access/service-catalog.store';
import { PRICING_BASIS_LABELS, SERVICE_CATALOG_TEXT } from '../../service-catalog.text';
import { PriceListsPanel } from './price-lists.panel';

@Component({
  selector: 'app-service-list-page',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzDrawerModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    PageHeaderComponent,
    CanDirective,
    VndPipe,
    ServiceFormComponent,
    PriceListsPanel,
  ],
  templateUrl: './service-list.page.html',
  providers: [ServiceCatalogStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceListPage implements OnInit {
  protected readonly store = inject(ServiceCatalogStore);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);

  protected readonly text = SERVICE_CATALOG_TEXT;
  protected readonly cycleLabels = BILLING_CYCLE_LABELS;
  protected readonly basisLabels = PRICING_BASIS_LABELS;
  /** Cột giá luôn có để bảng không lệch; chỉ hiện số khi có quyền tài chính. */
  protected readonly canFinance = computed(() => this.auth.can('finance:view'));
  protected readonly formVisible = signal(false);
  protected readonly editing = signal<ServiceType | null>(null);
  /** Dịch vụ đang mở ngăn bảng giá. */
  protected readonly pricing = signal<ServiceType | null>(null);
  protected search = '';

  ngOnInit(): void {
    void this.store.load();
  }

  protected applySearch(): void {
    this.store.setFilter({ search: this.search.trim() });
  }

  protected setActive(active: ServiceTypeFilter['active']): void {
    this.store.setFilter({ active });
  }

  protected open(service: ServiceType | null): void {
    this.store.saveError.set('');
    this.editing.set(service);
    this.formVisible.set(true);
  }

  protected async save(value: ServiceTypeInput): Promise<void> {
    if (await this.store.save(this.editing(), value)) {
      this.message.success(this.text.saved);
      this.formVisible.set(false);
    }
  }
}
