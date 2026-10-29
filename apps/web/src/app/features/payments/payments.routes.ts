import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Thu tiền & công nợ',
    loadComponent: () => import('./pages/payments.page').then((m) => m.PaymentsPage),
  },
] satisfies Routes;
