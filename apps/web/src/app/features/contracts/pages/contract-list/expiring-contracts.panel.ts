import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS } from '../../contract-labels';
import { LIFECYCLE_TEXT } from '../../contract-lifecycle.text';
import { ContractLifecycleApi, ExpiringContract } from '../../data-access/contract-lifecycle.api';

/** Số ngày mặc định; bước 11 đưa vào Cài đặt. */
const DEFAULT_DAYS = 30;

/** HĐ sắp hết hạn (04-D) trên trang danh sách: nhắc tái ký, ẩn khi không có HĐ nào. */
@Component({
  selector: 'app-expiring-contracts-panel',
  imports: [DatePipe, RouterLink, NzCollapseModule, NzTableModule, NzTagModule],
  template: `
    @if (items().length) {
      <nz-collapse style="margin-bottom: 16px">
        <nz-collapse-panel [nzHeader]="text.expiringTitle(days) + ' (' + items().length + ')'">
          <nz-table
            [nzData]="items()"
            [nzShowPagination]="false"
            [nzFrontPagination]="false"
            nzSize="small"
            [nzScroll]="{ x: '640px' }"
          >
            <thead>
              <tr>
                <th>HĐ</th>
                <th>{{ text.customer }}</th>
                <th>{{ text.endDate }}</th>
                <th>{{ text.renewStatus }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of items(); track c.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/contracts', c.id]">{{ c.code }}</a>
                  </td>
                  <td>{{ c.customer.name }}</td>
                  <td>
                    {{ c.endDate | date: 'dd/MM/yyyy' }}
                    <span class="text-muted">({{ text.daysLeft(c.daysLeft) }})</span>
                  </td>
                  <td>
                    @for (r of c.renewals; track r.id) {
                      <a [routerLink]="['/contracts', r.id]">{{ r.code }}</a>
                      <nz-tag [nzColor]="statusColors[r.status]">{{
                        statusLabels[r.status]
                      }}</nz-tag>
                    } @empty {
                      <span class="text-muted">{{ text.notRenewed }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-collapse-panel>
      </nz-collapse>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpiringContractsPanel implements OnInit {
  private readonly api = inject(ContractLifecycleApi);
  protected readonly text = LIFECYCLE_TEXT;
  protected readonly statusLabels = CONTRACT_STATUS_LABELS;
  protected readonly statusColors = CONTRACT_STATUS_COLORS;
  protected readonly days = DEFAULT_DAYS;
  protected readonly items = signal<ExpiringContract[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.items.set((await firstValueFrom(this.api.expiring(this.days))).items);
    } catch {
      // Khối nhắc việc phụ: lỗi tải không chặn danh sách HĐ.
      this.items.set([]);
    }
  }
}
