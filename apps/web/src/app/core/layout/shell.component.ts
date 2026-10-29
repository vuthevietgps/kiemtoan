import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NotificationBellComponent } from '../../features/notifications/notification-bell.component';
import { AuthService } from '../auth/auth.service';
import { ACCOUNT_TEXT } from '../auth/account.text';
import { MENU } from './menu';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzIconModule,
    NzAvatarModule,
    NzDropDownModule,
    NotificationBellComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly accountText = ACCOUNT_TEXT;
  protected readonly auth = inject(AuthService);
  protected readonly collapsed = signal(false);
  protected readonly menu = computed(() => {
    this.auth.permissions();
    return MENU.filter((item) => this.auth.can(item.permission));
  });
  protected readonly initials = computed(() =>
    (this.auth.user()?.fullName ?? '?')
      .split(' ')
      .slice(-1)[0]
      .charAt(0)
      .toUpperCase(),
  );
}
