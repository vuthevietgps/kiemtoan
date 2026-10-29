import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../../core/api/api';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { ExpiringContractsPanel } from './expiring-contracts.panel';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { PaymentTagComponent } from '../../components/payment-tag.component';
import {
  CONTRACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_OPTIONS,
  ContractStatus,
} from '../../contract-labels';
import { ContractListItem, ContractsApi } from '../../data-access/contracts.api';

@Component({
  selector: 'app-contract-list-page',
  imports: [
    FormsModule,
    RouterLink,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    PageHeaderComponent,
    CanDirective,
    ExpiringContractsPanel,
    VndPipe,
    PaymentTagComponent,
  ],
  templateUrl: './contract-list.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractListPage implements OnInit {
  private readonly api = inject(ContractsApi);
  private readonly message = inject(NzMessageService);

  protected readonly statusLabels = CONTRACT_STATUS_LABELS;
  protected readonly statusColors = CONTRACT_STATUS_COLORS;
  protected readonly statusOptions = CONTRACT_STATUS_OPTIONS;

  protected readonly items = signal<ContractListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly loading = signal(false);

  protected search = '';
  protected status: ContractStatus | null = null;

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
}
