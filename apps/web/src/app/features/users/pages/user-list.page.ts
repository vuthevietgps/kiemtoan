import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService, ROLE_LABELS } from '../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { CanDirective } from '../../../shared/directives/can.directive';
import { AdministrationAction, AdministrationPanelComponent } from '../components/administration-panel.component';
import { RolePermissionsCardComponent } from '../components/role-permissions-card.component';
import { UserFormModalComponent } from '../components/user-form-modal.component';
import { User, UserPayload, UsersApi } from '../data-access/users.api';
import { UsersStore } from '../data-access/users.store';
import { STATUS_LABELS, USERS_TEXT } from '../users.text';

@Component({
  selector: 'app-user-list-page', providers: [UsersStore],
  imports: [DatePipe, FormsModule, NzAlertModule, NzButtonModule, NzInputModule, NzModalModule, NzPopconfirmModule, NzSelectModule, NzTableModule, NzTagModule, PageHeaderComponent, CanDirective, AdministrationPanelComponent, RolePermissionsCardComponent, UserFormModalComponent],
  templateUrl: './user-list.page.html', styleUrl: './user-list.page.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListPage {
  protected readonly store = inject(UsersStore);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(UsersApi);
  protected readonly text = USERS_TEXT;
  protected readonly labels = ROLE_LABELS;
  protected readonly roleOptions = Object.entries(ROLE_LABELS);
  protected readonly statusOptions = Object.entries(STATUS_LABELS);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<User | null>(null);
  private searchTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    void this.store.metadata();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }
  protected onSearch(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.store.page.set(1); this.store.search.set(value.trim()); }, 300);
  }
  protected openForm(user: User | null): void { this.editing.set(user); this.modalOpen.set(true); }
  protected async save(payload: UserPayload): Promise<void> {
    if (await this.store.save(payload, this.editing())) this.modalOpen.set(false);
  }
  protected status(user: User): string {
    if (user.leftAt) return this.text.left;
    if (!user.isActive) return this.text.locked;
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) return this.text.temporaryLock;
    return user.mustChangePassword ? this.text.invited : this.text.active;
  }
  protected toggle(user: User): void { void this.store.action(this.api.setActive(user.id, !user.isActive)); }
  protected revoke(user: User): void { void this.store.action(this.api.revoke(user.id)); }
  protected leave(user: User): void { void this.store.action(this.api.leave(user.id)); }
  protected deliver(user: User, purpose: 'invite' | 'password-reset'): void { void this.store.deliver(user, purpose); }
  protected action(event: AdministrationAction): void {
    switch (event.type) {
      case 'request-page': this.store.requestPage.set(event.page); void this.store.metadata(); break;
      case 'request-status': this.store.requestStatus.set(event.status); this.store.requestPage.set(1); void this.store.metadata(); break;
      case 'team-save': void this.store.action(this.api.saveTeam(event.name, event.id)); break;
      case 'team-delete': void this.store.action(this.api.deleteTeam(event.id)); break;
      case 'role-save': void this.store.action(this.api.saveRole(event.role, event.id)); break;
      case 'role-delete': void this.store.action(this.api.deleteRole(event.id)); break;
      case 'review': void this.store.action(this.api.review(event.id, event.approve, event.reason)); break;
    }
  }
}
