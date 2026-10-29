import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { CredentialTableComponent } from '../../components/credential-table/credential-table.component';
import {
  ClientCredential,
  ClientCredentialsApi,
  daysUntil,
} from '../../data-access/client-credentials.api';

const EXPIRY_WARNING_DAYS = 30;

@Component({
  selector: 'app-credential-list-page',
  imports: [DatePipe, NzAlertModule, PageHeaderComponent, CredentialTableComponent],
  template: `
    <app-page-header
      title="Tài khoản công ty khách hàng"
      subtitle="Mật khẩu được mã hoá; mỗi lần xem mật khẩu đều được ghi nhật ký"
    />
    @if (expiring().length) {
      <nz-alert
        nzType="warning"
        nzShowIcon
        [nzMessage]="'Có ' + expiring().length + ' chữ ký số hết hạn trong 30 ngày tới'"
        [nzDescription]="expiringList"
        style="margin-bottom: 16px"
      />
      <ng-template #expiringList>
        <ul class="expiring">
          @for (c of expiring(); track c.id) {
            <li>
              <b>{{ c.customer.name }}</b> — {{ c.label || c.username }}: hết hạn
              {{ c.expiresAt | date: 'dd/MM/yyyy' }}
            </li>
          }
        </ul>
      </ng-template>
    }
    <div class="panel">
      <app-credential-table />
    </div>
  `,
  styles: `
    .expiring { margin: 0; padding-left: 18px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialListPage implements OnInit {
  private readonly api = inject(ClientCredentialsApi);
  protected readonly expiring = signal<ClientCredential[]>([]);

  ngOnInit(): void {
    this.api.list({ page: 1, pageSize: 100, type: 'DIGITAL_SIGNATURE' }).subscribe({
      next: (res) =>
        this.expiring.set(
          res.items.filter((c) => {
            const days = daysUntil(c.expiresAt);
            return days !== null && days <= EXPIRY_WARNING_DAYS;
          }),
        ),
    });
  }
}
