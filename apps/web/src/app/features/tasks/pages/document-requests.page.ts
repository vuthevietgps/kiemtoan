import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { TaskDocumentsComponent } from '../components/task-documents.component';
import { DocumentRequestQuery } from '../data-access/document-requests.api';
import { CustomerOption, TasksApi } from '../data-access/tasks.api';
import { DOCUMENT_REQUEST_LABELS, DocumentRequestStatus } from '../task-labels';

/**
 * Hồ sơ cần thu của khách (đặc tả 05-E, PL1 V): theo khách hàng, trạng thái, kỳ; ghi nhận đã yêu cầu,
 * tải thay khách, kiểm tra, cần bổ sung, chấp nhận. Chưa có cổng khách hàng (QD00).
 */
@Component({
  selector: 'app-document-requests-page',
  imports: [
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    PageHeaderComponent,
    TaskDocumentsComponent,
  ],
  template: `
    <app-page-header title="Hồ sơ khách hàng" subtitle="Hồ sơ cần thu của khách theo kỳ dịch vụ">
      <a nz-button routerLink="/tasks/my">Việc của tôi</a>
      <a nz-button routerLink="/tasks">Tất cả công việc</a>
    </app-page-header>
    <div class="panel">
      <div class="filters">
        <nz-select
          nzShowSearch
          nzAllowClear
          nzPlaceHolder="Khách hàng"
          [ngModel]="customerId()"
          (ngModelChange)="customerId.set($event ?? null)"
        >
          @for (c of customers(); track c.id) {
            <nz-option [nzValue]="c.id" [nzLabel]="c.name" />
          }
        </nz-select>
        <nz-select
          nzAllowClear
          nzPlaceHolder="Trạng thái"
          [ngModel]="status()"
          (ngModelChange)="status.set($event ?? null)"
        >
          @for (s of statuses; track s[0]) {
            <nz-option [nzValue]="s[0]" [nzLabel]="s[1].label" />
          }
        </nz-select>
        <input
          nz-input
          placeholder="Kỳ (YYYY-MM)"
          [ngModel]="period()"
          (ngModelChange)="period.set($event?.trim() || null)"
        />
      </div>
      <app-task-documents [query]="query()" [showCustomer]="true" [canAct]="canAct" />
    </div>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .filters nz-select {
      min-width: 200px;
    }
    .filters input {
      width: 160px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentRequestsPage {
  private readonly api = inject(TasksApi);
  protected readonly canAct = inject(AuthService).permissions().has('tasks:update');
  protected readonly statuses = Object.entries(DOCUMENT_REQUEST_LABELS) as [
    DocumentRequestStatus,
    { label: string },
  ][];
  protected readonly customers = signal<CustomerOption[]>([]);
  protected readonly customerId = signal<string | null>(null);
  protected readonly status = signal<DocumentRequestStatus | null>(null);
  protected readonly period = signal<string | null>(null);
  protected readonly query = computed<DocumentRequestQuery>(() => ({
    customerId: this.customerId(),
    status: this.status(),
    period: this.period(),
  }));

  constructor() {
    this.api.customerOptions().subscribe({
      next: (rows) => this.customers.set(rows),
      error: () => this.customers.set([]),
    });
  }
}
