import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';
import type { TaskPriority, TaskStatus } from '../../tasks/task-labels';

export interface MoneyKpi {
  value: string;
  previous: string;
  /** null = kỳ trước bằng 0, không so được. */
  changePercent: number | null;
}

export interface RecentContract {
  id: string;
  code: string;
  customerName: string;
  serviceTypes: string[];
  subtotal: string;
  total: string;
  status: string;
  paidAmount: string;
}

/** Tab Tài chính (10, M1, M4): chỉ người có `finance:view`. */
export interface FinanceData {
  from: string;
  to: string;
  kpis: {
    revenue: MoneyKpi;
    totalPayable: MoneyKpi;
    contracts: { total: number; new: number };
    servicesDone: number;
    servicesTotal: number;
  };
  revenueByServiceType: { serviceTypeId: string; name: string; amount: string }[];
  serviceStatus: { completed: number; notCompleted: number };
  paymentStatus: { paid: string; remaining: string };
  recentContracts: RecentContract[];
}

export interface PriorityTask {
  id: string;
  title: string;
  customerName: string;
  assigneeName: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  statutory: boolean;
  dueDate: string;
  daysLeft: number;
}

export interface ContractProgress {
  id: string;
  code: string;
  customerName: string;
  endDate: string | null;
  tasksDone: number;
  tasksAll: number;
  percent: number | null;
}

export interface DeadlineItem {
  kind: 'TASK' | 'OBLIGATION';
  id: string;
  title: string;
  customerName: string;
  statutory: boolean;
  dueDate: string;
  daysLeft: number;
}

export interface ImportantNotice {
  id: string;
  title: string;
  link: string | null;
  severity: 'WARNING' | 'DANGER';
  createdAt: string;
}

/** Tab Vận hành (10, M1–M2). Phần cần quyền việc / lịch báo cáo là null khi không có quyền. */
export interface OperationsData {
  from: string;
  to: string;
  cards: {
    activeContracts: number;
    openTasks: number | null;
    overdueTasks: number | null;
    waitingCustomer: number | null;
    awaitingMyReview: number | null;
    services: { done: number; total: number };
  };
  priorityTasks: PriorityTask[] | null;
  contractProgress: ContractProgress[];
  deadlines: DeadlineItem[];
  notifications: { items: ImportantNotice[]; unread: number };
}

export interface ServiceRow {
  id: string;
  name: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  contract: { id: string; code: string };
  customerName: string;
  completedOn: string | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/dashboard`;

  operations(from?: string, to?: string): Observable<OperationsData> {
    return this.http.get<OperationsData>(`${this.url}/operations`, {
      params: toParams({ from, to }),
    });
  }

  finance(from?: string, to?: string): Observable<FinanceData> {
    return this.http.get<FinanceData>(`${this.url}/finance`, { params: toParams({ from, to }) });
  }

  services(state: 'done' | 'open', from?: string, to?: string): Observable<ServiceRow[]> {
    return this.http.get<ServiceRow[]>(`${this.url}/operations/services`, {
      params: toParams({ state, from, to }),
    });
  }
}
