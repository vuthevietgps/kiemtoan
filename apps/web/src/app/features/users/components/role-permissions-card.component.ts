import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ROLE_LABELS } from '../../../core/auth/auth.service';
import { PermissionCatalog } from '../data-access/users.api';
import { permissionLabel, USERS_TEXT } from '../users.text';

@Component({
  selector: 'app-role-permissions-card',
  template: `<details><summary>{{ text.roles }}</summary><div class="roles">@for (role of catalog(); track role.role) { <section><b>{{ labels[role.role] }}</b><ul>@for (permission of role.permissions; track permission) { <li>{{ label(permission) }}</li> }</ul></section> }</div></details>`,
  styles: '.roles { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-top:12px; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissionsCardComponent {
  readonly catalog = input<PermissionCatalog[]>([]);
  protected readonly labels = ROLE_LABELS;
  protected readonly label = permissionLabel;
  protected readonly text = USERS_TEXT;
}
