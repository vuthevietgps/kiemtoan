import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { Role, ROLE_LABELS } from '../../../core/auth/auth.service';
import { AccessRole, Team, User, UserPayload } from '../data-access/users.api';
import { USERS_TEXT } from '../users.text';

@Component({
  selector: 'app-user-form-modal',
  imports: [ReactiveFormsModule, NzModalModule, NzFormModule, NzInputModule, NzSelectModule, NzButtonModule],
  templateUrl: './user-form-modal.component.html', styleUrl: './user-form-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormModalComponent {
  readonly open = input(false);
  readonly user = input<User | null>(null);
  readonly teams = input<Team[]>([]);
  readonly profiles = input<AccessRole[]>([]);
  readonly currentUserId = input<string>();
  readonly busy = input(false);
  readonly submitted = output<UserPayload>();
  readonly closed = output<void>();
  protected readonly text = USERS_TEXT;
  protected readonly self = computed(() => this.user()?.id === this.currentUserId());
  protected readonly roles = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value: value as Role, label }));
  protected readonly form = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.minLength(10), Validators.maxLength(72), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\p{L}\p{N}\s]).+$/u)] }),
    role: new FormControl<Role>('STAFF', { nonNullable: true }), teamId: new FormControl<string | null>(null),
    accessRoleId: new FormControl<string | null>(null), financialAccess: new FormControl<boolean | null>(null), secretAccess: new FormControl<boolean | null>(null),
    title: new FormControl(''), phone: new FormControl(''),
  });
  constructor() {
    effect(() => {
      if (!this.open()) return;
      const user = this.user();
      this.form.reset({ fullName: user?.fullName ?? '', email: user?.email ?? '', password: '', role: user?.role ?? 'STAFF',
        teamId: user?.teamId ?? null, title: user?.title ?? '', phone: user?.phone ?? '', accessRoleId: user?.accessRoleId ?? null,
        financialAccess: user?.financialAccess ?? null, secretAccess: user?.secretAccess ?? null });
      if (user) this.form.controls.email.disable(); else this.form.controls.email.enable();
      for (const key of ['role', 'accessRoleId', 'financialAccess', 'secretAccess'] as const) {
        if (this.self()) this.form.controls[key].disable(); else this.form.controls[key].enable();
      }
    });
  }
  protected submit(): void {
    if (this.busy()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    this.submitted.emit({ fullName: value.fullName.trim(), role: value.role, teamId: value.teamId,
      title: value.title?.trim() || null, phone: value.phone?.trim() || null, accessRoleId: value.accessRoleId,
      financialAccess: value.financialAccess, secretAccess: value.secretAccess,
      ...(!this.user() ? { email: value.email.trim(), ...(value.password ? { password: value.password } : {}) } : {}),
    });
  }
}
