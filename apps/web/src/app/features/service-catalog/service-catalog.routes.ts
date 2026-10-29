import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';

export default [
  {
    path: '',
    title: 'Dịch vụ & bảng giá',
    loadComponent: () =>
      import('./pages/service-list/service-list.page').then((m) => m.ServiceListPage),
  },
  {
    path: 'workflows',
    title: 'Quy trình mẫu',
    canActivate: [permissionGuard],
    data: { permission: 'workflow-templates:view' },
    loadComponent: () =>
      import('./pages/workflow-list/workflow-list.page').then((m) => m.WorkflowListPage),
  },
  {
    path: 'workflows/:id',
    title: 'Quy trình mẫu',
    canActivate: [permissionGuard],
    data: { permission: 'workflow-templates:view' },
    loadComponent: () =>
      import('./pages/workflow-detail/workflow-detail.page').then((m) => m.WorkflowDetailPage),
  },
] satisfies Routes;
