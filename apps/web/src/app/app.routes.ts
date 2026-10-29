import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from './core/auth/auth.guard';
import { LoginPage } from './core/auth/login.page';
import { ShellComponent } from './core/layout/shell.component';
import { HomePage } from './core/auth/home.page';

/** Mỗi tính năng lazy-load từ features/<tên>/<tên>.routes.ts và được chặn theo quyền. */
const feature = (path: string, permission: string, load: Routes[number]['loadChildren']) => ({
  path,
  canActivate: [permissionGuard],
  data: { permission },
  loadChildren: load,
});

export const routes: Routes = [
  { path: 'login', component: LoginPage, title: 'Đăng nhập' },
  ...(['forgot-password', 'reset-password', 'activate'] as const).map((path) => ({ path, loadComponent: () => import('./core/auth/password-action.page').then((module) => module.PasswordActionPage) })),
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', component: HomePage },
      { path: 'account', loadComponent: () => import('./core/auth/account.page').then((module) => module.AccountPage) },
      feature('dashboard', 'dashboard:view', () => import('./features/dashboard/dashboard.routes')),
      feature('customers', 'customers:view', () => import('./features/customers/customers.routes')),
      feature('contracts', 'contracts:view', () => import('./features/contracts/contracts.routes')),
      feature('service-catalog', 'service-catalog:view', () =>
        import('./features/service-catalog/service-catalog.routes'),
      ),
      feature('tasks', 'tasks:view', () => import('./features/tasks/tasks.routes')),
      feature('calendar', 'deadlines:view', () => import('./features/calendar/calendar.routes')),
      feature('deadlines', 'deadlines:view', () => import('./features/deadlines/deadlines.routes')),
      feature('deadline-settings', 'deadlines:view|settings:view', () =>
        import('./features/deadline-settings/deadline-settings.routes'),
      ),
      feature('payments', 'payments:view', () => import('./features/payments/payments.routes')),
      feature('invoices', 'invoices:view', () => import('./features/invoices/invoices.routes')),
      feature('client-credentials', 'client-credentials:view', () =>
        import('./features/client-credentials/client-credentials.routes'),
      ),
      feature('reports', 'reports:view', () => import('./features/reports/reports.routes')),
      feature('users', 'users:view', () => import('./features/users/users.routes')),
      feature('audit-log', 'audit-log:view', () => import('./features/audit-log/audit-log.routes')),
    ],
  },
  { path: '**', redirectTo: '' },
];
