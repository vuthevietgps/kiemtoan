/** Menu bên trái (theo màn hình mẫu). Mục chỉ hiện khi người dùng có quyền tương ứng. */
export interface MenuItem {
  label: string;
  icon: string;
  link: string;
  /** 'a|b' = có một trong các quyền. */
  permission: string;
}

export const MENU: MenuItem[] = [
  { label: 'Tổng quan', icon: 'home', link: '/dashboard', permission: 'dashboard:view' },
  { label: 'Khách hàng', icon: 'team', link: '/customers', permission: 'customers:view' },
  { label: 'Hợp đồng', icon: 'file-text', link: '/contracts', permission: 'contracts:view' },
  { label: 'Dịch vụ & quy trình', icon: 'appstore', link: '/service-catalog', permission: 'service-catalog:view' },
  { label: 'Công việc', icon: 'check-square', link: '/tasks', permission: 'tasks:view' },
  { label: 'Lịch & Deadline', icon: 'calendar', link: '/calendar', permission: 'deadlines:view' },
  { label: 'Lịch báo cáo', icon: 'safety-certificate', link: '/deadlines', permission: 'deadlines:view' },
  { label: 'Thu tiền', icon: 'dollar', link: '/payments', permission: 'payments:view' },
  { label: 'Quản lý hoá đơn', icon: 'profile', link: '/invoices', permission: 'invoices:view' },
  { label: 'Tài khoản công ty', icon: 'key', link: '/client-credentials', permission: 'client-credentials:view' },
  { label: 'Báo cáo', icon: 'bar-chart', link: '/reports', permission: 'reports:view' },
  { label: 'Người dùng', icon: 'user', link: '/users', permission: 'users:view' },
  { label: 'Cấu hình lịch & nhắc', icon: 'clock-circle', link: '/deadline-settings', permission: 'deadlines:view|settings:view' },
  { label: 'Nhật ký hoạt động', icon: 'history', link: '/audit-log', permission: 'audit-log:view' },
];
