import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { CREDENTIALS_TEXT } from '../../client-credentials.text';
import { CredentialVaultComponent } from '../../components/credential-vault.component';

/** Kho tài khoản khách hàng và chữ ký số (đặc tả 09); `?id=` mở thẳng một tài khoản. */
@Component({
  selector: 'app-credential-list-page',
  imports: [PageHeaderComponent, CredentialVaultComponent],
  template: `
    <app-page-header [title]="text.title" [subtitle]="text.subtitle" />
    <div class="panel">
      <app-credential-vault [syncUrl]="true" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialListPage {
  protected readonly text = CREDENTIALS_TEXT;
}
