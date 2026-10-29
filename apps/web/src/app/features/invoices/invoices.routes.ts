import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Quản lý hoá đơn',
    loadComponent: () => import('./pages/invoice-list.page').then((m) => m.InvoiceListPage),
  },
] satisfies Routes;
