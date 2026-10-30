import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { fromDateKey, toDateKey } from '../../../../shared/utils/date-key';
import {
  CREDENTIAL_STATUS_OPTIONS,
  CREDENTIAL_TYPE_OPTIONS,
  CredentialStatus,
  CredentialType,
} from '../../../customers/customer-labels';
import { CustomerOption } from '../../../customers/data-access/customers.api';
import { TOKEN_PROVIDER_LABELS, TokenProvider } from '../../client-credentials.text';
import { ClientCredential, CredentialInput } from '../../data-access/client-credentials.api';

const TOKEN: CredentialType = 'DIGITAL_SIGNATURE';

/**
 * Thêm / sửa tài khoản hoặc token (09-D; L1, L2). Bắt buộc theo loại: token cần nhà cung cấp, serial,
 * hạn (PIN tuỳ chọn); tài khoản cổng cần tên đăng nhập và mật khẩu khi thêm; loại "Khác" cần tên.
 * Sửa: bỏ trống mật khẩu = giữ nguyên; không đổi qua lại giữa token và tài khoản cổng.
 */
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
  readonly credential = input<ClientCredential | null>(null);
  /** Có giá trị = khoá khách hàng (mở từ hồ sơ khách hàng). */
  readonly customerId = input<string | null>(null);
  readonly customers = input<CustomerOption[]>([]);
  /** Loại mặc định khi thêm (tab đang mở). */
  readonly defaultType = input<CredentialType>('TAX_PORTAL');
  readonly busy = input(false);
  readonly submitted = output<CredentialInput>();
  readonly cancelled = output<void>();

  protected readonly statusOptions = CREDENTIAL_STATUS_OPTIONS;
  protected readonly providers = Object.entries(TOKEN_PROVIDER_LABELS).map(([value, label]) => ({
    value: value as TokenProvider,
    label,
  }));
  protected readonly type = signal<CredentialType>('TAX_PORTAL');
  protected readonly token = computed(() => this.type() === TOKEN);
  /** Sửa: chỉ đổi trong cùng nhóm (token ↔ token, cổng ↔ cổng). */
  protected readonly typeOptions = computed(() => {
    const c = this.credential();
    if (!c) return CREDENTIAL_TYPE_OPTIONS;
    const token = c.type === TOKEN;
    return CREDENTIAL_TYPE_OPTIONS.filter((o) => (o.value === TOKEN) === token);
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    customerId: ['', Validators.required],
    type: ['TAX_PORTAL' as CredentialType, Validators.required],
    label: [''],
    url: [''],
    username: [''],
    password: [''],
    expiresAt: [null as Date | null],
    status: ['ACTIVE' as CredentialStatus],
    note: [''],
    provider: [null as TokenProvider | null],
    serialNumber: [''],
    storageLocation: [''],
  });

  constructor() {
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      this.type.set(type);
      this.applyRules();
    });
    effect(() => {
      const c = this.credential();
      const type = c?.type ?? this.defaultType();
      this.form.reset({
        customerId: c?.customerId ?? this.customerId() ?? '',
        type,
        label: c?.label ?? '',
        url: c?.url ?? '',
        username: c?.username ?? '',
        password: '',
        expiresAt: c?.expiresAt ? fromDateKey(c.expiresAt) : null,
        status: c?.status ?? 'ACTIVE',
        note: c?.note ?? '',
        provider: c?.provider ?? null,
        serialNumber: c?.serialNumber ?? '',
        storageLocation: c?.storageLocation ?? '',
      });
      this.type.set(type);
      this.applyRules();
    });
  }

  /** Đặt lại điều kiện bắt buộc theo loại đang chọn. */
  private applyRules(): void {
    const token = this.token();
    const creating = !this.credential();
    const c = this.form.controls;
    const rule = (on: boolean): ValidatorFn[] => (on ? [Validators.required] : []);
    c.label.setValidators(rule(this.type() === 'OTHER'));
    c.username.setValidators(rule(!token));
    c.password.setValidators(rule(!token && creating));
    c.provider.setValidators(rule(token));
    c.serialNumber.setValidators(rule(token));
    c.expiresAt.setValidators(rule(token));
    for (const control of [
      c.label,
      c.username,
      c.password,
      c.provider,
      c.serialNumber,
      c.expiresAt,
    ])
      control.updateValueAndValidity({ emitEvent: false });
  }

  protected submit(): void {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity({ emitEvent: false });
      });
      return;
    }
    const raw = this.form.getRawValue();
    const token = raw.type === TOKEN;
    const input: CredentialInput = {
      type: raw.type,
      label: raw.label.trim() || null,
      url: raw.url.trim() || null,
      expiresAt: raw.expiresAt ? toDateKey(raw.expiresAt) : null,
      status: raw.status,
      note: raw.note.trim() || null,
      ...(raw.password && { password: raw.password }),
      ...(token
        ? {
            provider: raw.provider,
            serialNumber: raw.serialNumber.trim(),
            storageLocation: raw.storageLocation.trim() || null,
          }
        : { username: raw.username.trim() }),
      ...(!this.credential() && { customerId: raw.customerId }),
    };
    this.submitted.emit(input);
  }
}
