import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
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
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { errorMessage } from '../../../../core/api/api';
import { SecretVerificationService } from '../../../../core/auth/secret-verification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CanDirective } from '../../../../shared/directives/can.directive';
import {
  CREDENTIAL_STATUS_COLORS,
  CREDENTIAL_STATUS_LABELS,
  CREDENTIAL_TYPE_LABELS,
  CREDENTIAL_TYPE_OPTIONS,
  CredentialType,
} from '../../../customers/customer-labels';
import { CustomerOption, CustomersApi } from '../../../customers/data-access/customers.api';
import {
  ClientCredential,
  ClientCredentialsApi,
  daysUntil,
} from '../../data-access/client-credentials.api';
import { CredentialFormComponent } from '../credential-form/credential-form.component';

const EXPIRY_WARNING_DAYS = 30;

/**
 * Bảng tài khoản công ty khách hàng. Dùng ở trang /client-credentials (mọi khách hàng)
 * và tab "Tài khoản đăng nhập" của chi tiết khách hàng (truyền customerId).
 */
@Component({
  selector: 'app-credential-table',
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
    NzTooltipModule,
    CanDirective,
    CredentialFormComponent,
  ],
  templateUrl: './credential-table.component.html',
  styles: `
    .secret {
      font-family: monospace;
      background: #f6f8fa;
      padding: 0 6px;
      border-radius: 4px;
    }
    .expiry-warn {
      color: #d4380d;
      font-weight: 500;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialTableComponent {
  private readonly api = inject(ClientCredentialsApi);
  private readonly customersApi = inject(CustomersApi);
  private readonly message = inject(NzMessageService);
  private readonly verification = inject(SecretVerificationService);

  readonly customerId = input<string | null>(null);

  protected readonly typeLabels = CREDENTIAL_TYPE_LABELS;
  protected readonly typeOptions = CREDENTIAL_TYPE_OPTIONS;
  protected readonly statusLabels = CREDENTIAL_STATUS_LABELS;
  protected readonly statusColors = CREDENTIAL_STATUS_COLORS;

  protected readonly items = signal<ClientCredential[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly loading = signal(false);
  protected readonly customers = signal<CustomerOption[]>([]);
  /** Mật khẩu đã giải mã, chỉ giữ trong bộ nhớ của trang. */
  protected readonly revealed = signal<Record<string, string>>({});
  protected readonly formVisible = signal(false);
  protected readonly editing = signal<ClientCredential | null>(null);

  protected filterCustomerId: string | null = null;
  protected filterType: CredentialType | null = null;
  protected search = '';

  constructor() {
    effect(() => {
      const customerId = this.customerId();
      untracked(() => {
        if (!customerId) {
          this.customersApi.options().subscribe({ next: (list) => this.customers.set(list) });
        }
        this.load();
      });
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .list({
        page: this.page(),
        pageSize: this.pageSize(),
        customerId: this.customerId() ?? this.filterCustomerId,
        type: this.filterType,
        search: this.search.trim(),
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

  protected daysLeft(c: ClientCredential): number | null {
    return daysUntil(c.expiresAt);
  }

  protected expiringSoon(c: ClientCredential): boolean {
    const days = this.daysLeft(c);
    return days !== null && days <= EXPIRY_WARNING_DAYS;
  }

  protected reveal(c: ClientCredential): void {
    this.api.reveal(c.id).subscribe({
      next: ({ password }) => this.revealed.update((m) => ({ ...m, [c.id]: password })),
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.error?.code === 'SECRET_REAUTH_REQUIRED') {
          void this.verification.verify().then((verified) => { if (verified) this.reveal(c); });
        } else this.message.error(errorMessage(err));
      },
    });
  }

  protected hide(c: ClientCredential): void {
    this.revealed.update((current) => {
      const next = { ...current };
      delete next[c.id];
      return next;
    });
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.message.success('Đã sao chép');
    } catch {
      this.message.error('Trình duyệt không cho phép sao chép');
    }
  }

  protected openForm(c: ClientCredential | null): void {
    this.editing.set(c);
    this.formVisible.set(true);
  }

  protected onSaved(): void {
    this.formVisible.set(false);
    this.load();
  }

  protected remove(c: ClientCredential): void {
    this.api.remove(c.id).subscribe({
      next: () => {
        this.message.success('Đã xoá tài khoản');
        this.load();
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }
}
