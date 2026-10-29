import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked, viewChild } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { AuthService } from '../../../core/auth/auth.service';
import { CustomerRelationshipsComponent, RelationshipAction } from '../components/customer-relationships/customer-relationships.component';
import { RELATIONSHIP_TEXT } from '../customer-relationships.text';
import { CustomerRelationshipsApi } from '../data-access/customer-relationships.api';
import { CustomerRelationshipsStore } from '../data-access/customer-relationships.store';

@Component({
  selector: 'app-customer-relationships-panel',
  imports: [CustomerRelationshipsComponent, NzAlertModule, NzButtonModule, NzSpinModule],
  providers: [CustomerRelationshipsStore],
  template: `
    @if (store.error(); as error) { <nz-alert nzType="error" [nzMessage]="error" /><button nz-button (click)="reload()">{{ text.retry }}</button> }
    <nz-spin [nzSpinning]="store.loading()">
      <app-customer-relationships [contacts]="store.contacts()" [assignments]="store.assignments()" [options]="store.options()" [canManage]="auth.can('customers:update')" [busy]="store.busy()"
        [contactPage]="store.contactPage()" [contactTotal]="store.contactTotal()" [assignmentPage]="store.assignmentPage()" [assignmentTotal]="store.assignmentTotal()"
        (contactPageChange)="store.contactPage.set($event); reload()" (assignmentPageChange)="store.assignmentPage.set($event); reload()"
        (searchChange)="store.search.set($event); store.contactPage.set(1); reload()" (personSearch)="store.loadOptions($event)" (action)="perform($event)" />
    </nz-spin>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerRelationshipsPanel {
  readonly customerId = input.required<string>();
  readonly changed = output<void>();
  protected readonly store = inject(CustomerRelationshipsStore);
  protected readonly auth = inject(AuthService);
  protected readonly text = RELATIONSHIP_TEXT;
  private readonly api = inject(CustomerRelationshipsApi);
  private readonly form = viewChild(CustomerRelationshipsComponent);

  constructor() { effect(() => { const id = this.customerId(); untracked(() => { void this.store.load(id); if (this.auth.can('customers:update')) void this.store.loadOptions(); }); }); }
  protected reload() { void this.store.load(this.customerId()); }
  protected async perform(action: RelationshipAction) {
    const id = this.customerId();
    const request = action.type === 'contact' ? this.api.saveContact(id, action.value, action.id)
      : action.type === 'removeContact' ? this.api.removeContact(id, action.id)
      : action.type === 'unassign' ? this.api.unassign(id, action.id)
      : this.api.assign(id, action.userId, action.note);
    if (await this.store.perform(id, request)) { if (action.type === 'contact') this.form()?.reset(); this.changed.emit(); }
  }
}
