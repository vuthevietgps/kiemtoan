import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { errorMessage } from '../api/api';
import { AccountApi } from './account.api';
import { ACCOUNT_TEXT } from './account.text';

@Component({
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzInputModule],
  template: `
    <p>{{ text.verifyHint }}</p>
    @if (error(); as message) { <nz-alert nzType="error" [nzMessage]="message" /> }
    <form (ngSubmit)="submit()">
      <label>{{ text.currentPassword }}<input nz-input name="password" type="password" autocomplete="current-password" [(ngModel)]="password" /></label>
      <button nz-button nzType="primary" type="submit" [disabled]="!password" [nzLoading]="busy()">{{ text.verifyButton }}</button>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretVerificationDialog {
  private readonly api = inject(AccountApi);
  private readonly modal = inject(NzModalRef);
  protected readonly text = ACCOUNT_TEXT;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected password = '';
  protected async submit(): Promise<void> {
    if (this.busy() || !this.password) return;
    this.busy.set(true); this.error.set(null);
    try { await firstValueFrom(this.api.verify(this.password)); this.password = ''; this.modal.close(true); }
    catch (error) { this.error.set(errorMessage(error)); this.password = ''; }
    finally { this.busy.set(false); }
  }
}

@Injectable({ providedIn: 'root' })
export class SecretVerificationService {
  private readonly modal = inject(NzModalService);
  async verify(): Promise<boolean> {
    const ref = this.modal.create<SecretVerificationDialog, unknown, boolean>({ nzTitle: ACCOUNT_TEXT.verify, nzContent: SecretVerificationDialog, nzFooter: null, nzMaskClosable: false });
    return (await firstValueFrom(ref.afterClose)) === true;
  }
}
