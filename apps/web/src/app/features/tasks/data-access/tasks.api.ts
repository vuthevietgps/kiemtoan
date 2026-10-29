import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { DueFilter, StatusFilter, TaskAction, TaskPriority, TaskStatus, Urgency } from '../task-labels';

export interface IdName {
  id: string;
  name: string;
}

export interface TaskRow {
  id: string;
  code: string;
  title: string;
  period: string | null;
  dueDate: string;
  originalDueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  requiresEvidence: boolean;
  requiresDelivery: boolean;
  isStatutory: boolean;
  reviewLevels: number;
  reviewLevel: number | null;
  reviewerId: string | null;
  approverId: string | null;
  returnCount: number;
  firstSubmittedAt: string | null;
  acceptedAt: string | null;
  resultNote: string | null;
  legacy: boolean;
  statusBeforeHold: TaskStatus | null;
  reopenCount: number;
  /** H6: bước trước cùng kỳ chưa xong (rỗng = đủ điều kiện bắt đầu). */
  waitingFor: string[];
  note: string | null;
  customerId: string;
  contractId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  customer: IdName;
  contract: { id: string; code: string } | null;
  assignee: { id: string; fullName: string } | null;
  serviceTypeName: string | null;
  evidenceCount: number;
  isOverdue: boolean;
  /** 06 (I11): null khi việc đã hoàn thành. */
  urgency: Urgency | null;
}

export interface EvidenceDoc {
  id: string;
  fileName: string;
  size: number;
  note: string | null;
  createdAt: string;
  uploadedBy: { id: string; fullName: string };
}

export interface TaskHistoryItem {
  id: string;
  action: string;
  detail: { from?: TaskStatus; to?: TaskStatus; fileName?: string } | null;
  createdAt: string;
  user: { id: string; fullName: string } | null;
}

type Person = { id: string; fullName: string } | null;

export interface TaskStatusEvent {
  id: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  note: string | null;
  occurredAt: string;
  actor: Person;
}

export interface TaskReviewItem {
  id: string;
  level: number;
  decision: 'ACCEPT' | 'RETURN';
  note: string | null;
  enteredAt: string;
  decidedAt: string;
  reviewer: Person;
}

export interface ClientWait {
  id: string;
  automatic: boolean;
  fromStatus: TaskStatus;
  note: string | null;
  startedAt: string;
  endedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: Person;
}

export interface DueChange {
  id: string;
  oldDue: string;
  newDue: string;
  reason: string;
  documented: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  requestedBy: Person;
  decidedBy: Person;
}

export interface TaskDetail extends TaskRow {
  createdBy: Person;
  approvedBy: Person;
  reviewer: Person;
  approver: Person;
  documents: EvidenceDoc[];
  statusEvents: TaskStatusEvent[];
  reviews: TaskReviewItem[];
  /** 05-D: khoảng chờ khách, số ngày chờ đã xác nhận (G5), gia hạn (H7). */
  clientWaits: ClientWait[];
  confirmedWaitDays: number;
  dueChanges: DueChange[];
  /** 05-E: bình luận, mới nhất trước. */
  comments: TaskComment[];
  history: TaskHistoryItem[];
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  author: Person;
}

/** Việc của tôi (05-E): 4 tab. */
export type MyTab = 'today' | 'upcoming' | 'overdue' | 'done';

export interface MyTasksResult extends Paginated<TaskRow> {
  counts: Record<MyTab, number>;
}

/** Hàng đợi soát xét: số ngày làm việc đã chờ ở cấp hiện tại, quá SLA 2 ngày (G7). */
export interface ReviewQueueRow extends TaskRow {
  levelEnteredAt: string;
  waitingDays: number;
  overSla: boolean;
}

export interface TaskSummary {
  dueToday: number;
  remaining: number;
  overdue: number;
  doneThisMonth: number;
  missingEvidence: number;
  /** 05-E: chờ tôi kiểm tra/phê duyệt, chờ khách, đang soát xét. */
  awaitingMyReview: number;
  waitingClient: number;
  inReview: number;
  byStatus: Record<TaskStatus, number>;
}

export interface CustomerTaskStats {
  customerId: string;
  customerName: string;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  missingEvidence: number;
}

export interface WorkloadRow {
  userId: string;
  fullName: string;
  role: string;
  open: number;
  overdue: number;
  doneThisMonth: number;
}

export interface CalendarTask {
  id: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  period: string | null;
  isOverdue: boolean;
  customer: IdName;
  assignee: { id: string; fullName: string } | null;
}

export interface TaskQuery {
  page: number;
  pageSize: number;
  status?: StatusFilter | null;
  customerId?: string | null;
  assigneeId?: string | null;
  due?: DueFilter | null;
  missingEvidence?: boolean | null;
  completedThisMonth?: boolean | null;
  mine?: boolean | null;
  search?: string | null;
  reviewerId?: string | null;
  priority?: TaskPriority | null;
  statutory?: boolean | null;
}

export interface CreateTaskBody {
  customerId: string;
  title: string;
  dueDate: string;
  assigneeId?: string;
  requiresEvidence: boolean;
  note?: string;
}

export interface UpdateTaskBody {
  title?: string;
  dueDate?: string;
  note?: string;
  assigneeId?: string | null;
  reviewerId?: string | null;
  approverId?: string | null;
}

export interface CustomerOption {
  id: string;
  name: string;
  taxCode: string;
}

export interface UserOption {
  id: string;
  fullName: string;
  role: string;
  teamId: string | null;
}

@Injectable({ providedIn: 'root' })
export class TasksApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/tasks`;

  list(query: TaskQuery): Observable<Paginated<TaskRow>> {
    return this.http.get<Paginated<TaskRow>>(this.url, { params: toParams({ ...query }) });
  }

  summary(mine: boolean): Observable<TaskSummary> {
    return this.http.get<TaskSummary>(`${this.url}/summary`, { params: toParams({ mine }) });
  }

  byCustomer(): Observable<CustomerTaskStats[]> {
    return this.http.get<CustomerTaskStats[]>(`${this.url}/by-customer`);
  }

  workload(): Observable<WorkloadRow[]> {
    return this.http.get<WorkloadRow[]>(`${this.url}/workload`);
  }

  calendar(from: string, to: string, mine: boolean): Observable<CalendarTask[]> {
    return this.http.get<CalendarTask[]>(`${this.url}/calendar`, {
      params: toParams({ from, to, mine }),
    });
  }

  get(id: string): Observable<TaskDetail> {
    return this.http.get<TaskDetail>(`${this.url}/${id}`);
  }

  create(body: CreateTaskBody): Observable<TaskRow> {
    return this.http.post<TaskRow>(this.url, body);
  }

  update(id: string, body: UpdateTaskBody): Observable<TaskRow> {
    return this.http.patch<TaskRow>(`${this.url}/${id}`, body);
  }

  /** Thao tác của người làm: bắt đầu, gửi kiểm tra, hoàn thành, giao nộp (đặc tả 05). */
  act(id: string, action: TaskAction, note?: string): Observable<TaskRow> {
    return this.http.post<TaskRow>(`${this.url}/${id}/${action}`, note ? { note } : {});
  }

  /** 05-D: chờ khách, tạm dừng, mở lại, gia hạn, xác nhận khoảng chờ. */
  followUp(
    id: string,
    action: 'wait-client' | 'resume' | 'hold' | 'unhold' | 'reopen',
    body: object = {},
  ): Observable<TaskRow> {
    return this.http.post<TaskRow>(`${this.url}/${id}/${action}`, body);
  }

  requestDueChange(
    id: string,
    body: { newDue: string; reason: string; documented?: boolean },
  ): Observable<TaskRow> {
    return this.http.post<TaskRow>(`${this.url}/${id}/due-changes`, body);
  }

  decideDueChange(id: string, changeId: string, approve: boolean): Observable<TaskRow> {
    return this.http.post<TaskRow>(`${this.url}/${id}/due-changes/${changeId}/decide`, {
      approve,
    });
  }

  confirmWait(id: string, waitId: string): Observable<TaskRow> {
    return this.http.post<TaskRow>(`${this.url}/${id}/client-waits/${waitId}/confirm`, {});
  }

  my(tab: MyTab, page: number, pageSize: number): Observable<MyTasksResult> {
    return this.http.get<MyTasksResult>(`${this.url}/my`, {
      params: toParams({ tab, page, pageSize }),
    });
  }

  reviewQueue(): Observable<ReviewQueueRow[]> {
    return this.http.get<ReviewQueueRow[]>(`${this.url}/review-queue`);
  }

  /** Giao lại hàng loạt; việc không đủ điều kiện được bỏ qua kèm lý do. */
  reassign(
    taskIds: string[],
    assigneeId: string,
  ): Observable<{ updated: string[]; skipped: { id: string; reason: string }[] }> {
    return this.http.post<{ updated: string[]; skipped: { id: string; reason: string }[] }>(
      `${this.url}/reassign`,
      { taskIds, assigneeId },
    );
  }

  comment(id: string, content: string): Observable<TaskComment> {
    return this.http.post<TaskComment>(`${this.url}/${id}/comments`, { content });
  }

  /** Kiểm tra/phê duyệt cấp hiện tại. */
  review(id: string, decision: 'ACCEPT' | 'RETURN', note?: string): Observable<TaskRow> {
    return this.http.post<TaskRow>(`${this.url}/${id}/review`, { decision, note });
  }

  uploadEvidence(id: string, file: File, note?: string): Observable<EvidenceDoc> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (note) form.append('note', note);
    return this.http.post<EvidenceDoc>(`${this.url}/${id}/evidence`, form);
  }

  /** Danh sách khách hàng cho ô chọn (module customers). */
  customerOptions(): Observable<CustomerOption[]> {
    return this.http.get<CustomerOption[]>(`${API_URL}/customers/options`);
  }

  /** Danh sách người dùng cho ô chọn nhân viên. */
  userOptions(): Observable<UserOption[]> {
    return this.http.get<UserOption[]>(`${API_URL}/users/options`);
  }
}
