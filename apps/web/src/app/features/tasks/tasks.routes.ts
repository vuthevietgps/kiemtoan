import { Routes } from '@angular/router';
import { DocumentRequestsPage } from './pages/document-requests.page';
import { MyTasksPage } from './pages/my-tasks.page';
import { TasksPage } from './pages/tasks.page';

export default [
  { path: '', component: TasksPage, title: 'Công việc' },
  // 05-E (H11): Việc của tôi và hàng đợi soát xét; hồ sơ cần thu của khách.
  { path: 'my', component: MyTasksPage, title: 'Việc của tôi' },
  { path: 'documents', component: DocumentRequestsPage, title: 'Hồ sơ khách hàng' },
] satisfies Routes;
