import { inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { USERS_TEXT } from '../users.text';
import { AccessRequest, AccessRole, AccountLink, PermissionCatalog, Team, User, UserPayload, UsersApi } from './users.api';

@Injectable()
export class UsersStore {
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly search = signal('');
  readonly role = signal<string | null>(null);
  readonly teamId = signal<string | null>(null);
  readonly status = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly link = signal<AccountLink | null>(null);
  readonly teams = signal<Team[]>([]);
  readonly roles = signal<AccessRole[]>([]);
  readonly catalog = signal<PermissionCatalog[]>([]);
  readonly requests = signal<AccessRequest[]>([]);
  readonly requestPage = signal(1);
  readonly requestTotal = signal(0);
  readonly requestStatus = signal<string | null>('PENDING');
  readonly users = rxResource({
    params: () => ({ page: this.page(), pageSize: this.pageSize(), search: this.search(), role: this.role() as User['role'] | null, teamId: this.teamId(), status: this.status() }),
    stream: ({ params }) => this.api.list(params),
  });

  async metadata(): Promise<void> {
    try {
      const [teams, roles, catalog] = await Promise.all([firstValueFrom(this.api.teams()), firstValueFrom(this.api.roles()), firstValueFrom(this.api.catalog())]);
      this.teams.set(teams); this.roles.set(roles); this.catalog.set(catalog);
      if (this.auth.can('users:manage_access')) {
        const requests = await firstValueFrom(this.api.requests(this.requestPage(), this.requestStatus()));
        this.requests.set(requests.items); this.requestTotal.set(requests.total);
      }
    } catch (error) { this.error.set(errorMessage(error)); }
  }

  async save(payload: UserPayload, user: User | null): Promise<boolean> {
    return this.perform(async () => {
      const saved = await firstValueFrom(user ? this.api.update(user.id, payload) : this.api.create(payload));
      this.success.set(saved.accessRequests.length ? USERS_TEXT.pendingHint : USERS_TEXT.saved);
      if (!user && !payload.password) {
        try { this.link.set(await firstValueFrom(this.api.accountLink(saved.id, 'invite'))); }
        catch (error) { this.error.set(errorMessage(error)); }
      }
    });
  }
  async action(request: Observable<unknown>): Promise<boolean> {
    return this.perform(async () => { await firstValueFrom(request); this.success.set(USERS_TEXT.done); });
  }
  async deliver(user: User, purpose: 'invite' | 'password-reset'): Promise<void> {
    await this.perform(async () => { this.link.set(await firstValueFrom(this.api.accountLink(user.id, purpose))); });
  }
  private async perform(action: () => Promise<void>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true); this.error.set(null); this.success.set(null);
    try {
      await action(); this.users.reload(); await this.metadata(); return true;
    } catch (error) { this.error.set(errorMessage(error)); return false; }
    finally { this.busy.set(false); }
  }
}
