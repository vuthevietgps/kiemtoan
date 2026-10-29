import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';

export default [
  {
    path: '',
    title: 'Hợp đồng',
    loadComponent: () =>
      import('./pages/contract-list/contract-list.page').then((m) => m.ContractListPage),
  },
  {
    path: 'new',
    title: 'Tạo hợp đồng',
    canActivate: [permissionGuard],
    data: { permission: 'contracts:create' },
    loadComponent: () =>
      import('./pages/contract-form/contract-form.page').then((m) => m.ContractFormPage),
  },
  {
    path: 'templates',
    title: 'Mẫu hồ sơ',
    canActivate: [permissionGuard],
    data: { permission: 'contracts:approve' },
    loadComponent: () =>
      import('./pages/document-templates/document-templates.page').then(
        (m) => m.DocumentTemplatesPage,
      ),
  },
  {
    path: 'audit-tracking',
    title: 'Theo dõi kiểm toán',
    loadComponent: () =>
      import('./pages/audit-tracking/audit-tracking.page').then((m) => m.AuditTrackingPage),
  },
  {
    path: ':id/edit',
    title: 'Sửa hợp đồng',
    canActivate: [permissionGuard],
    data: { permission: 'contracts:update' },
    loadComponent: () =>
      import('./pages/contract-form/contract-form.page').then((m) => m.ContractFormPage),
  },
  {
    path: ':id',
    title: 'Chi tiết hợp đồng',
    loadComponent: () =>
      import('./pages/contract-detail/contract-detail.page').then((m) => m.ContractDetailPage),
  },
] satisfies Routes;
