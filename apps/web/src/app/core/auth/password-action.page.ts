import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { errorMessage } from '../api/api';
import { AccountApi } from './account.api';
import { ACCOUNT_TEXT } from './account.text';

@Component({
  imports: [ReactiveFormsModule, RouterLink, NzAlertModule, NzButtonModule, NzInputModule],
  templateUrl: './password-action.page.html', styleUrl: './password-action.page.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordActionPage {
  private readonly api = inject(AccountApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly text = ACCOUNT_TEXT;
  protected readonly mode = this.route.snapshot.routeConfig?.path as 'activate' | 'reset-password' | 'forgot-password';
  private readonly token = new URLSearchParams(this.route.snapshot.fragment ?? '').get('token') ?? '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true }), password: new FormControl('', { nonNullable: true }), confirm: new FormControl('', { nonNullable: true }),
  });
  constructor() {
    if (this.mode === 'forgot-password') this.form.controls.email.setValidators([Validators.required, Validators.email]);
    else {
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(10), Validators.maxLength(72), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\p{L}\p{N}\s]).+$/u)]);
      this.form.controls.confirm.setValidators(Validators.required);
      if (this.token.length !== 64) this.error.set(this.text.invalidToken);
    }
    Object.values(this.form.controls).forEach((control) => control.updateValueAndValidity());
    if (this.token) history.replaceState(null, '', location.pathname);
  }
  protected async submit(): Promise<void> {
    if (this.busy() || this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    if (this.mode !== 'forgot-password' && value.password !== value.confirm) { this.error.set(this.text.mismatch); return; }
    this.busy.set(true); this.error.set(null);
    try {
      if (this.mode === 'forgot-password') this.message.set((await firstValueFrom(this.api.forgot(value.email))).message);
      else { await firstValueFrom(this.api.reset(this.mode, this.token, value.password)); this.message.set(this.text.success); this.form.reset(); }
    } catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
