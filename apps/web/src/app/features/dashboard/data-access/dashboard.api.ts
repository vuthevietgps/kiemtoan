import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';

import type { TaskStatus } from '../../tasks/task-labels';

/** Ba nhóm việc của tôi: Chưa làm / Đang làm (gồm soát xét) / Hoàn thành (đặc tả 05). */
export type TaskGroup = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface MoneyKpi {
  value: string;
  previous: string;
  /** null = kỳ trước bằng 0, không so được. */
  changePercent: number | null;
}

export interface DashboardTask {
  id: string;
  title: string;
  customerName: string;
  assigneeName: string | null;
  status: TaskStatus;
  dueDate: string;
  completedAt: string | null;
  daysLeft: number;
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

export interface DashboardData {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  kpis: {
    revenue: MoneyKpi;
    totalPayable: MoneyKpi;
    contracts: { total: number; new: number };
    servicesDone: number;
    servicesTotal: number;
  };
  revenueByServiceType: { name: string; amount: string }[];
  serviceStatus: { completed: number; notCompleted: number };
  paymentStatus: { paid: string; remaining: string };
  recentContracts: RecentContract[];
  myTasks: Record<TaskGroup, number>;
  myTaskItems: Record<TaskGroup, DashboardTask[]>;
  upcoming: DashboardTask[];
  reportDeadlines: DashboardTask[];
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);

  load(from?: string, to?: string): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${API_URL}/dashboard`, {
      params: toParams({ from, to }),
    });
  }
}
