import { Routes } from '@angular/router';
import { CustomerDetailPage } from './pages/customer-detail/customer-detail.page';
import { CustomerListPage } from './pages/customer-list/customer-list.page';

export default [
  { path: '', component: CustomerListPage, title: 'Khách hàng' },
  { path: ':id', component: CustomerDetailPage, title: 'Chi tiết khách hàng' },
] satisfies Routes;
