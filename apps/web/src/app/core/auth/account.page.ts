import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { errorMessage } from '../api/api';
import { AccountApi } from './account.api';
import { ACCOUNT_TEXT } from './account.text';
import { AuthService } from './auth.service';
import { NotificationPreferencesComponent } from '../../features/notifications/notification-preferences.component';

@Component({
  imports: [DatePipe, NotificationPreferencesComponent, ReactiveFormsModule, NzAlertModule, NzButtonModule, NzInputModule, NzPopconfirmModule, NzTableModule],
  templateUrl: './account.page.html', styleUrl: './account.page.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage {
  private readonly api = inject(AccountApi);
  protected readonly auth = inject(AuthService);
  protected readonly text = ACCOUNT_TEXT;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly sessions = rxResource({ stream: () => this.api.sessions() });
  protected readonly profile = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    phone: new FormControl(''), title: new FormControl(''),
  });
  protected readonly password = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10), Validators.maxLength(72), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\p{L}\p{N}\s]).+$/u)] }),
    confirm: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  constructor() { void this.loadProfile(); }
  protected async loadProfile(): Promise<void> {
    try { this.profile.patchValue(await firstValueFrom(this.api.profile())); }
    catch (error) { this.error.set(errorMessage(error)); }
  }
  protected async saveProfile(): Promise<void> {
    if (this.profile.invalid || this.busy()) { this.profile.markAllAsTouched(); return; }
    this.busy.set(true); this.error.set(null);
    try { await firstValueFrom(this.api.updateProfile(this.profile.getRawValue())); await this.auth.reloadSession(); this.success.set(this.text.saved); }
    catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
  protected async changePassword(): Promise<void> {
    if (this.password.invalid || this.busy()) { this.password.markAllAsTouched(); return; }
    const value = this.password.getRawValue();
    if (value.password !== value.confirm) { this.error.set(this.text.mismatch); return; }
    this.busy.set(true); this.error.set(null);
    try { await firstValueFrom(this.api.changePassword(value.currentPassword, value.password)); this.password.reset(); this.auth.logout(); }
    catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
  protected async revoke(id?: string, current = false): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(null);
    try {
      await firstValueFrom(this.api.revoke(id));
      if (!id || current) this.auth.logout(); else { this.sessions.reload(); this.success.set(this.text.revoked); }
    } catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
