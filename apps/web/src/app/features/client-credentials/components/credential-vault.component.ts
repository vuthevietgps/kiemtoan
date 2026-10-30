import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { SecretVerificationService } from '../../../core/auth/secret-verification.service';
import { CanDirective } from '../../../shared/directives/can.directive';
import {
  CREDENTIAL_STATUS_OPTIONS,
  CREDENTIAL_TYPE_OPTIONS,
} from '../../customers/customer-labels';
import { CustomerOption, CustomersApi } from '../../customers/data-access/customers.api';
import {
  CREDENTIALS_TEXT,
  CredentialDialog,
  CUSTODY_LABELS,
  DIALOG_TITLES,
  REVEAL_SECONDS,
  TokenCustody,
} from '../client-credentials.text';
import {
  ClientCredentialsApi,
  CredentialInput,
  Person,
} from '../data-access/client-credentials.api';
import { CredentialAction, CredentialsStore } from '../data-access/credentials.store';
import { SecretAccessService } from '../data-access/secret-access.service';
import { AccountTableComponent } from './account-table.component';
import { CredentialActionFormComponent } from './credential-action-form.component';
import { CredentialDrawerComponent } from './credential-drawer.component';
import { CredentialFormComponent } from './credential-form/credential-form.component';
import { TokenTableComponent } from './token-table.component';

/**
 * Kho tài khoản khách hàng (09-D): tab Tài khoản cổng / Chữ ký số, lọc, cảnh báo hết hạn và token chưa rõ
 * nơi giữ, ngăn chi tiết, thêm / sửa, thao tác token, Xem (tự ẩn 30 giây) và Sao chép (không hiện).
 * Dùng ở `/client-credentials` (`syncUrl`: `?id=` mở thẳng, từ thông báo nhắc hạn) và tab Tài khoản của KH.
 */
@Component({
  selector: 'app-credential-vault',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTabsModule,
    CanDirective,
    AccountTableComponent,
    TokenTableComponent,
    CredentialDrawerComponent,
    CredentialFormComponent,
    CredentialActionFormComponent,
  ],
  providers: [CredentialsStore, SecretAccessService, SecretVerificationService],
  templateUrl: './credential-vault.component.html',
  styleUrl: './credential-vault.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialVaultComponent {
  protected readonly store = inject(CredentialsStore);
  private readonly api = inject(ClientCredentialsApi);
  private readonly customersApi = inject(CustomersApi);
  private readonly secrets = inject(SecretAccessService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);

  readonly customerId = input<string | null>(null);
  readonly syncUrl = input(false);

  protected readonly text = CREDENTIALS_TEXT;
  protected readonly titles = DIALOG_TITLES;
  protected readonly typeOptions = CREDENTIAL_TYPE_OPTIONS.filter(
    (o) => o.value !== 'DIGITAL_SIGNATURE',
  );
  protected readonly statusOptions = CREDENTIAL_STATUS_OPTIONS;
  protected readonly custodyOptions = (Object.keys(CUSTODY_LABELS) as TokenCustody[]).map(
    (value) => ({
      value,
      label: CUSTODY_LABELS[value],
    }),
  );
  protected readonly customers = signal<CustomerOption[]>([]);
  protected readonly users = signal<Person[]>([]);
  protected readonly search = signal('');
  protected readonly tokenTab = computed(() => this.store.query().kind === 'TOKEN');
  protected readonly canUpdate = computed(() => this.auth.can('client-credentials:update'));
  protected readonly canDelete = computed(() => this.auth.can('client-credentials:delete'));
  protected readonly canViewSecret = computed(() =>
    this.auth.can('client-credentials:view_secret'),
  );
  protected readonly userId = computed(() => this.auth.user()?.id ?? null);

  /** Biểu mẫu thêm (`'new'`) / sửa (`'edit'`) và hộp thoại thao tác đang mở. */
  protected readonly form = signal<'new' | 'edit' | null>(null);
  protected readonly dialog = signal<CredentialDialog | null>(null);
  protected readonly revealed = signal<string | null>(null);
  protected readonly revealLeft = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
    effect(() => {
      const customerId = this.customerId();
      untracked(() => {
        this.store.query.update((q) => ({ ...q, customerId }));
        if (!customerId)
          this.customersApi.options().subscribe({ next: (list) => this.customers.set(list) });
        void this.store.load();
        const id = this.syncUrl() ? this.route.snapshot.queryParamMap.get('id') : null;
        if (id) void this.store.open(id);
      });
    });
    // Đổi tài khoản đang mở / đóng ngăn → ẩn mật khẩu đang hiện (tải lại cùng tài khoản thì giữ).
    let shownId: string | undefined;
    effect(() => {
      const id = this.store.detail()?.id;
      if (id === shownId) return;
      shownId = id;
      untracked(() => this.hide());
    });
  }

  protected selectTab(index: number): void {
    this.search.set('');
    this.store.setKind(index === 1 ? 'TOKEN' : 'ACCOUNT');
  }

  protected applySearch(): void {
    this.store.setQuery({ search: this.search().trim() });
  }

  protected open(id: string): void {
    void this.store.open(id);
    if (this.syncUrl()) void this.router.navigate([], { queryParams: { id }, replaceUrl: true });
  }

  protected close(): void {
    this.store.close();
    if (this.syncUrl()) void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected async save(input: CredentialInput): Promise<void> {
    try {
      if (this.form() === 'edit') {
        if (!(await this.store.act({ kind: 'update', input }))) {
          this.message.error(this.store.actionError());
          return;
        }
      } else {
        await this.store.create(input);
      }
      this.form.set(null);
      this.message.success(this.text.done);
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }

  protected openDialog(dialog: CredentialDialog): void {
    if (dialog === 'handOver' && !this.users().length)
      this.api.users().subscribe({ next: (list) => this.users.set(list) });
    this.dialog.set(dialog);
  }

  protected async act(action: CredentialAction): Promise<void> {
    if (await this.store.act(action)) {
      this.dialog.set(null);
      this.message.success(this.text.done);
    } else {
      this.message.error(this.store.actionError());
    }
  }

  /** L6: hiện 30 giây rồi tự ẩn; máy chủ ghi "Xem". */
  protected async view(): Promise<void> {
    const id = this.store.detail()?.id;
    if (!id) return;
    try {
      const secret = await this.secrets.fetch(id, 'VIEW');
      if (secret === null) return;
      this.hide();
      this.revealed.set(secret);
      this.revealLeft.set(REVEAL_SECONDS);
      this.timer = setInterval(() => {
        this.revealLeft.update((s) => s - 1);
        if (this.revealLeft() <= 0) this.hide();
      }, 1000);
      if (this.store.accessLog()) void this.store.loadAccessLog();
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }

  /** L6: chép thẳng vào bộ nhớ tạm, không hiện lên màn hình; máy chủ ghi "Sao chép". */
  protected async copy(): Promise<void> {
    const id = this.store.detail()?.id;
    if (!id) return;
    try {
      const secret = await this.secrets.fetch(id, 'COPY');
      if (secret === null) return;
      await navigator.clipboard.writeText(secret).then(
        () => this.message.success(this.text.copied),
        () => this.message.error(this.text.copyFailed),
      );
      if (this.store.accessLog()) void this.store.loadAccessLog();
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }

  protected hide(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.revealed.set(null);
    this.revealLeft.set(0);
  }
}
