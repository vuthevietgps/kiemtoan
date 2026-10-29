import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { errorMessage } from '../../../../core/api/api';
import {
  CREDENTIAL_STATUS_OPTIONS,
  CREDENTIAL_TYPE_OPTIONS,
  CredentialStatus,
  CredentialType,
} from '../../../customers/customer-labels';
import { CustomerOption } from '../../../customers/data-access/customers.api';
import {
  ClientCredential,
  ClientCredentialsApi,
  CredentialInput,
} from '../../data-access/client-credentials.api';

/** Ngày → 'YYYY-MM-DD' theo giờ máy (tránh lệch ngày do UTC). */
function toDateString(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Form thêm / sửa tài khoản công ty khách hàng. Sửa: bỏ trống mật khẩu = giữ nguyên. */
@Component({
  selector: 'app-credential-form',
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule,
  ],
  templateUrl: './credential-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialFormComponent {
  private readonly api = inject(ClientCredentialsApi);
  private readonly message = inject(NzMessageService);

  readonly credential = input<ClientCredential | null>(null);
  /** Có giá trị = khoá khách hàng (mở từ trang chi tiết khách hàng). */
  readonly customerId = input<string | null>(null);
  readonly customers = input<CustomerOption[]>([]);
  readonly saved = output<ClientCredential>();
  readonly cancelled = output<void>();

  protected readonly typeOptions = CREDENTIAL_TYPE_OPTIONS;
  protected readonly statusOptions = CREDENTIAL_STATUS_OPTIONS;
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    customerId: ['', Validators.required],
    type: ['TAX_PORTAL' as CredentialType, Validators.required],
    label: [''],
    url: [''],
    username: ['', Validators.required],
    password: [''],
    expiresAt: [null as Date | null],
    status: ['ACTIVE' as CredentialStatus],
    note: [''],
  });

  constructor() {
    effect(() => {
      const c = this.credential();
      const lockedCustomer = this.customerId();
      this.form.reset({
        customerId: c?.customerId ?? lockedCustomer ?? '',
        type: c?.type ?? 'TAX_PORTAL',
        label: c?.label ?? '',
        url: c?.url ?? '',
        username: c?.username ?? '',
        password: '',
        expiresAt: c?.expiresAt ? new Date(c.expiresAt) : null,
        status: c?.status ?? 'ACTIVE',
        note: c?.note ?? '',
      });
      const password = this.form.controls.password;
      password.setValidators(c ? [] : [Validators.required]);
      password.updateValueAndValidity();
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity();
      });
      return;
    }
    const raw = this.form.getRawValue();
    const current = this.credential();
    const input: CredentialInput = {
      type: raw.type,
      label: raw.label || null,
      url: raw.url || null,
      username: raw.username,
      status: raw.status,
      note: raw.note || null,
      expiresAt: toDateString(raw.expiresAt),
      ...(raw.password && { password: raw.password }),
    };
    const request = current
      ? this.api.update(current.id, input)
      : this.api.create({ ...input, customerId: raw.customerId });
    this.saving.set(true);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.message.success(current ? 'Đã lưu tài khoản' : 'Đã thêm tài khoản');
        this.saved.emit(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }
}
