import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { DocumentCategory } from '../../customers/customer-labels';

export type WorkflowStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type ScheduleMode = 'PERIODIC' | 'PROJECT';
export type WorkflowRole = 'STAFF' | 'MANAGER' | 'DIRECTOR';

export interface WorkflowStep {
  key: string;
  phase: string | null;
  name: string;
  instructions: string | null;
  required: boolean;
  durationDays: number | null;
  dueOffsetDays: number | null;
  performerRole: WorkflowRole | null;
  defaultAssigneeId: string | null;
  reviewLevels: number;
  reviewerRole: WorkflowRole | null;
  defaultReviewerId: string | null;
  defaultApproverId: string | null;
  requiresEvidence: boolean;
  evidenceHint: string | null;
  /** Hạn pháp lý (G6), cần xác nhận giao nộp (H1), loại nghĩa vụ lấy hạn theo lịch báo cáo (06, I6). */
  isStatutory?: boolean;
  requiresDelivery?: boolean;
  obligationTypeId?: string | null;
  dependsOn: string[];
}

/** Loại nghĩa vụ pháp lý đang dùng để gắn vào bước có hạn pháp lý (06). */
export interface ObligationTypeOption {
  id: string;
  code: string;
  name: string;
  retiredAt: string | null;
}

/** Hồ sơ cần khách hàng cung cấp (đặc tả 03-C). */
export interface DocumentRequirement {
  name: string;
  instructions: string | null;
  required: boolean;
  category: DocumentCategory;
  perPeriod: boolean;
  stepKey: string | null;
}

export interface VersionSummary {
  id: string;
  versionNo: number;
  status: WorkflowStatus;
  scheduleMode: ScheduleMode;
  publishedAt: string | null;
  updatedAt: string;
  _count: { steps: number };
}

export interface WorkflowTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  serviceType: { id: string; code: string; name: string };
  versions: VersionSummary[];
  activeVersion: VersionSummary | null;
  draftVersion: VersionSummary | null;
}

export interface WorkflowVersion {
  id: string;
  versionNo: number;
  status: WorkflowStatus;
  scheduleMode: ScheduleMode;
  revision: number;
  note: string | null;
  clonedFromId: string | null;
  publishedAt: string | null;
  template: { id: string; code: string; name: string; isDefault: boolean; serviceType: { id: string; code: string; name: string } };
  steps: WorkflowStep[];
  requirements: DocumentRequirement[];
}

export interface WorkflowPreview {
  scheduleMode: ScheduleMode;
  startDate: string;
  period: string;
  totalWorkingDays: number | null;
  steps: { key: string; name: string; phase: string | null; start: string | null; end: string }[];
}

/** Người dùng có thể chọn làm người mặc định (trong phạm vi người đang đăng nhập). */
export interface WorkflowUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface WorkflowFilter {
  serviceTypeId: string;
  search: string;
  page: number;
}

@Injectable({ providedIn: 'root' })
export class WorkflowsApi {
  private readonly http = inject(HttpClient);

  list(filter: WorkflowFilter): Observable<Paginated<WorkflowTemplate>> {
    return this.http.get<Paginated<WorkflowTemplate>>(`${API_URL}/workflow-templates`, {
      params: toParams({ ...filter, pageSize: 20 }),
    });
  }

  template(id: string): Observable<WorkflowTemplate> {
    return this.http.get<WorkflowTemplate>(`${API_URL}/workflow-templates/${id}`);
  }

  createTemplate(input: { serviceTypeId: string; name: string; description?: string | null }): Observable<WorkflowTemplate> {
    return this.http.post<WorkflowTemplate>(`${API_URL}/workflow-templates`, input);
  }

  updateTemplate(id: string, input: { name?: string; isActive?: boolean; isDefault?: boolean }): Observable<WorkflowTemplate> {
    return this.http.patch<WorkflowTemplate>(`${API_URL}/workflow-templates/${id}`, input);
  }

  version(id: string): Observable<WorkflowVersion> {
    return this.http.get<WorkflowVersion>(`${API_URL}/workflow-versions/${id}`);
  }

  save(
    id: string,
    input: { revision: number; scheduleMode: ScheduleMode; note: string | null; steps: WorkflowStep[]; requirements: DocumentRequirement[] },
  ): Observable<WorkflowVersion> {
    return this.http.put<WorkflowVersion>(`${API_URL}/workflow-versions/${id}`, input);
  }

  clone(id: string, input: { serviceTypeId?: string; name?: string } = {}): Observable<WorkflowVersion> {
    return this.http.post<WorkflowVersion>(`${API_URL}/workflow-versions/${id}/clone`, input);
  }

  publish(id: string): Observable<WorkflowVersion> {
    return this.http.post<WorkflowVersion>(`${API_URL}/workflow-versions/${id}/publish`, {});
  }

  remove(id: string): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(`${API_URL}/workflow-versions/${id}`);
  }

  /** Loại nghĩa vụ chưa ngừng (cần quyền xem lịch báo cáo). */
  obligationTypes(): Observable<ObligationTypeOption[]> {
    return this.http
      .get<ObligationTypeOption[]>(`${API_URL}/obligation-types`)
      .pipe(map((types) => types.filter((t) => !t.retiredAt)));
  }

  userOptions(): Observable<WorkflowUserOption[]> {
    return this.http.get<WorkflowUserOption[]>(`${API_URL}/users/options`);
  }

  preview(id: string, startDate: string | null, period: string | null): Observable<WorkflowPreview> {
    return this.http.get<WorkflowPreview>(`${API_URL}/workflow-versions/${id}/preview`, {
      params: toParams({ startDate, period }),
    });
  }
}
