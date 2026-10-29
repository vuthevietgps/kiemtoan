import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/api/api';
import type { TaskStatus } from '../../tasks/task-labels';
import { TaskGenerationStatus } from './contracts.api';

export type PlanStatus = 'DRAFT' | 'CONFIRMED';

export interface PlanStep {
  id: string;
  stepKey: string;
  sortOrder: number;
  phase: string | null;
  name: string;
  required: boolean;
  skipped: boolean;
  durationDays: number | null;
  dueOffsetDays: number | null;
  dependsOn: string[];
  plannedStart: string | null;
  dueDate: string;
  requiresEvidence: boolean;
  reviewLevels: number;
  assigneeId: string | null;
  reviewerId: string | null;
  /** Người mặc định của bước đã nghỉ (chỉ khi kế hoạch nháp). */
  warning?: string | null;
  /** Việc đã sinh từ bước, mỗi kỳ một việc (05-C), để xem tiến độ theo giai đoạn. */
  tasks?: { status: TaskStatus; period: string | null }[];
}

export interface PlanRequirement {
  id: string;
  name: string;
  required: boolean;
  perPeriod: boolean;
  stepKey: string | null;
}

export interface ContractPlan {
  id: string;
  workflowVersionId: string | null;
  workflowCode: string | null;
  workflowVersionNo: number | null;
  scheduleMode: 'PERIODIC' | 'PROJECT';
  startDate: string;
  period: string;
  status: PlanStatus;
  revision: number;
  note: string | null;
  confirmedAt: string | null;
  steps: PlanStep[];
  requirements: PlanRequirement[];
}

export interface WorkflowOption {
  id: string;
  versionNo: number;
  template: { code: string; name: string; isDefault: boolean };
}

export interface PeriodProgress {
  period: string | null;
  total: number;
  completed: number;
  done: boolean;
}

export interface PlanLine {
  id: string;
  period: string | null;
  serviceType: { code: string; name: string };
  taskGenerationStatus: TaskGenerationStatus;
  taskGenerationMessage: string | null;
  /** Tiến độ từng kỳ: kỳ hoàn tất khi mọi việc bắt buộc Hoàn thành. */
  periods: PeriodProgress[];
  plan: ContractPlan | null;
  workflowOptions: WorkflowOption[];
}

export interface PlanStepChange {
  stepKey: string;
  skipped?: boolean;
  assigneeId?: string | null;
  reviewerId?: string | null;
  durationDays?: number;
  dueOffsetDays?: number;
}

/** Thay đổi chung của kế hoạch chưa lưu. */
export interface PlanHeaderChange {
  startDate?: string;
  period?: string;
  note?: string | null;
}

/** Lịch của một bước khi áp thay đổi chưa lưu. */
export interface PlanPreviewStep {
  stepKey: string;
  skipped: boolean;
  plannedStart: string | null;
  dueDate: string;
}

@Injectable({ providedIn: 'root' })
export class ContractPlansApi {
  private readonly http = inject(HttpClient);

  list(contractId: string): Observable<{ status: string; lines: PlanLine[] }> {
    return this.http.get<{ status: string; lines: PlanLine[] }>(
      `${API_URL}/contracts/${contractId}/plans`,
    );
  }

  create(
    contractId: string,
    lineId: string,
    input: { workflowVersionId?: string; startDate?: string },
  ): Observable<ContractPlan> {
    return this.http.post<ContractPlan>(
      `${API_URL}/contracts/${contractId}/services/${lineId}/plan`,
      input,
    );
  }

  update(
    planId: string,
    input: PlanHeaderChange & { revision: number; steps: PlanStepChange[] },
  ): Observable<ContractPlan> {
    return this.http.put<ContractPlan>(`${API_URL}/contract-plans/${planId}`, input);
  }

  preview(
    planId: string,
    input: Omit<PlanHeaderChange, 'note'> & { steps: PlanStepChange[] },
  ): Observable<PlanPreviewStep[]> {
    return this.http.post<PlanPreviewStep[]>(`${API_URL}/contract-plans/${planId}/preview`, input);
  }

  confirm(planId: string): Observable<ContractPlan> {
    return this.http.post<ContractPlan>(`${API_URL}/contract-plans/${planId}/confirm`, {});
  }

  reopen(planId: string): Observable<ContractPlan> {
    return this.http.post<ContractPlan>(`${API_URL}/contract-plans/${planId}/reopen`, {});
  }
}
