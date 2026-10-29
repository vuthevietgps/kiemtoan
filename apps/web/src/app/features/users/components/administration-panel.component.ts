import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { Role, ROLE_LABELS } from '../../../core/auth/auth.service';
import { AccessRequest, AccessRole, PermissionCatalog, Team } from '../data-access/users.api';
import { permissionLabel, SCOPE_LABELS, USERS_TEXT } from '../users.text';

export type AdministrationAction =
  | { type: 'request-page'; page: number }
  | { type: 'request-status'; status: string | null }
  | { type: 'team-save'; name: string; id?: string }
  | { type: 'team-delete'; id: string }
  | { type: 'role-save'; role: Omit<AccessRole, 'id'>; id?: string }
  | { type: 'role-delete'; id: string }
  | { type: 'review'; id: string; approve: boolean; reason: string };

@Component({
  selector: 'app-administration-panel',
  imports: [DatePipe, FormsModule, NzButtonModule, NzCheckboxModule, NzInputModule, NzModalModule, NzPopconfirmModule, NzSelectModule, NzTableModule],
  templateUrl: './administration-panel.component.html', styleUrl: './administration-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdministrationPanelComponent {
  readonly teams = input<Team[]>([]);
  readonly roles = input<AccessRole[]>([]);
  readonly catalog = input<PermissionCatalog[]>([]);
  readonly requests = input<AccessRequest[]>([]);
  readonly busy = input(false);
  readonly canManage = input(false);
  readonly canManageRoles = input(false);
  readonly canReview = input(false);
  readonly showRequests = input(false);
  readonly requestTotal = input(0);
  readonly requestPage = input(1);
  readonly requestStatus = input<string | null>('PENDING');
  readonly action = output<AdministrationAction>();
  protected readonly text = USERS_TEXT;
  protected readonly labels = ROLE_LABELS;
  protected readonly scopes = SCOPE_LABELS;
  protected readonly permissionLabel = permissionLabel;
  protected teamName = '';
  protected teamId?: string;
  protected readonly roleOpen = signal(false);
  protected readonly baseRole = signal<Role>('STAFF');
  protected roleId?: string;
  protected roleName = '';
  protected scope = 'OWN';
  protected readonly permissions = signal<string[]>([]);
  protected readonly roleOptions: Role[] = ['STAFF', 'MANAGER', 'CASHIER'];
  protected readonly scopeOptions = computed(() => this.baseRole() === 'MANAGER' ? ['TEAM', 'OWN', 'NONE'] : this.baseRole() === 'CASHIER' ? ['ALL', 'OWN', 'NONE'] : ['OWN', 'NONE']);
  protected readonly permissionOptions = computed(() => [...new Set([
    ...(this.catalog().find((row) => row.role === this.baseRole())?.permissions ?? []),
    'finance:view', 'reports:view_financial', 'payments:view', 'invoices:view', 'client-credentials:view_secret',
  ])].filter((permission) => !/^(users|audit-log|settings|access-control):/.test(permission)).sort());
  protected readonly reviewing = signal<AccessRequest | null>(null);
  protected decision = true;
  protected reason = '';

  protected editTeam(team: Team): void { this.teamName = team.name; this.teamId = team.id; }
  protected saveTeam(): void {
    if (this.busy() || this.teamName.trim().length < 2) return;
    this.action.emit({ type: 'team-save', name: this.teamName.trim(), id: this.teamId });
    this.teamName = ''; this.teamId = undefined;
  }
  protected editRole(role: AccessRole | null): void {
    this.roleId = role?.id; this.roleName = role?.name ?? ''; this.baseRole.set(role?.baseRole ?? 'STAFF');
    this.scope = role?.scope ?? 'OWN'; this.permissions.set(role?.permissions ?? []); this.roleOpen.set(true);
  }
  protected changeBase(role: Role): void { this.baseRole.set(role); this.scope = 'OWN'; this.permissions.set([]); }
  protected check(permission: string, enabled: boolean): void {
    this.permissions.update((all) => enabled ? [...new Set([...all, permission])] : all.filter((value) => value !== permission));
  }
  protected saveRole(): void {
    if (this.busy() || this.roleName.trim().length < 2) return;
    this.action.emit({ type: 'role-save', id: this.roleId, role: { name: this.roleName.trim(), baseRole: this.baseRole(), scope: this.scope, permissions: this.permissions() } });
    this.roleOpen.set(false);
  }
  protected review(request: AccessRequest, approve: boolean): void { this.reviewing.set(request); this.decision = approve; this.reason = ''; }
  protected submitReview(): void {
    const request = this.reviewing();
    if (!request || this.busy() || this.reason.trim().length < 3) return;
    this.action.emit({ type: 'review', id: request.id, approve: this.decision, reason: this.reason.trim() });
    this.reviewing.set(null);
  }
  protected accessLabel(value: boolean | null | undefined): string { return value == null ? this.text.inherited : value ? this.text.granted : this.text.denied; }
  protected profileName(id?: string | null): string { return this.roles().find((role) => role.id === id)?.name ?? this.text.defaultRole; }
}
