import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';
import type { TaskPriority } from '../../tasks/task-labels';

export type AuditStage = 'NOT_STARTED' | 'FIELDWORK' | 'REVIEW' | 'AWAITING_ISSUE' | 'ISSUED';
export type DeadlineKind = 'FIELDWORK_END' | 'REVIEW_END' | 'REPORT_ISSUE';
export type DeadlineResult = 'ON_TIME' | 'LATE' | 'OVERDUE' | 'DUE_SOON' | 'PENDING';
export type ClientDeliveryStatus =
  'NOT_SENT' | 'SOFT_COPY' | 'SIGNED_SCAN' | 'HARD_COPY' | 'HARD_AND_SOFT';
export type OriginalFilingStatus = 'NOT_FILED' | 'AWAITING_SIGNATURE' | 'FILED';
export type AcceptanceStatus = 'NONE' | 'AWAITING_SIGNATURE' | 'SIGNED';

export interface AuditUserRef {
  id: string;
  fullName: string;
  active?: boolean;
}

export interface Outcome {
  result: DeadlineResult;
  days: number;
}

export interface EngagementDeadline {
  kind: DeadlineKind;
  originalDue: string;
  currentDue: string;
  achievedAt: string | null;
  current: Outcome;
  original: Outcome;
  extended: boolean;
  changes: {
    oldDue: string | null;
    newDue: string;
    reason: string;
    changedBy: AuditUserRef | null;
    changedAt: string;
  }[];
}

export interface AuditNote {
  id: string;
  content: string;
  author: AuditUserRef | null;
  createdAt: string;
}

export interface AuditEngagementView {
  lineId: string;
  serviceType: { id: string; code: string; name: string };
  period: string | null;
  description: string | null;
  year: number;
  engagement: {
    id: string | null;
    stage: AuditStage;
    priority: TaskPriority;
    revision: number;
    manager: AuditUserRef | null;
    lead: AuditUserRef | null;
    signer1: AuditUserRef | null;
    signer2: AuditUserRef | null;
    assistants: (AuditUserRef | null)[];
    reportNumber: string | null;
    reportDate: string | null;
    reportDocumentId: string | null;
    issuedAt: string | null;
    issuedBy: AuditUserRef | null;
    deadlinesLocked: boolean;
    deadlines: EngagementDeadline[];
    suggestedIssueDue: string | null;
    timeline: {
      from: AuditStage;
      to: AuditStage;
      reason: string | null;
      actor: AuditUserRef | null;
      occurredAt: string;
    }[];
    /** Báo cáo tình hình cụ thể (04-F4), mới nhất trước. */
    notes: AuditNote[];
  };
  unassigned: AuditUserRef[];
  canEdit: boolean;
  canPrioritize: boolean;
  canNote: boolean;
  canIssue: boolean;
  canExtend: boolean;
}

export interface ContractDossier {
  revision: number;
  clientDeliveryStatus: ClientDeliveryStatus;
  clientDeliveredAt: string | null;
  originalFilingStatus: OriginalFilingStatus;
  originalFiledAt: string | null;
  originalFilingNote: string | null;
  acceptanceStatus: AcceptanceStatus;
  acceptanceSignedAt: string | null;
  acceptanceDocument: { id: string; documentId: string; fileName: string } | null;
}

export interface ContractAuditView {
  contract: { id: string; code: string; status: string };
  dossier: ContractDossier;
  canEditDossier: boolean;
  engagements: AuditEngagementView[];
}

export interface TeamInput {
  revision: number;
  managerId: string | null;
  leadId: string | null;
  signer1Id: string | null;
  signer2Id: string | null;
  assistantIds: string[];
  fieldworkDue?: string | null;
  reviewDue?: string | null;
  issueDue?: string | null;
}

export type DossierInput = Omit<ContractDossier, 'acceptanceDocument'> & {
  acceptanceDocumentId: string | null;
};

export interface BoardQuery {
  page: number;
  pageSize: number;
  search?: string;
  year?: number | null;
  serviceTypeId?: string | null;
  stage?: AuditStage | null;
  priority?: TaskPriority | null;
  ownerId?: string | null;
  managerId?: string | null;
  leadId?: string | null;
  signerId?: string | null;
  deadline?: 'OVERDUE' | 'DUE_SOON' | 'LATE' | 'EXTENDED' | null;
  dossierIncomplete?: boolean;
  uninvoiced?: boolean;
  receivable?: boolean;
  sort?: 'priority' | 'signedDate' | 'code' | 'stage' | 'issueDue' | 'reportDate' | null;
  order?: 'asc' | 'desc' | null;
}

export interface BoardRow {
  lineId: string;
  contract: {
    id: string;
    code: string;
    status: string;
    signedDate: string | null;
    owner: AuditUserRef | null;
  };
  customer: { id: string; name: string; taxCode: string };
  year: number;
  serviceType: { id: string; code: string; name: string };
  period: string | null;
  stage: AuditStage;
  priority: TaskPriority;
  lastNote: { content: string; createdAt: string; author: AuditUserRef | null } | null;
  manager: AuditUserRef | null;
  lead: AuditUserRef | null;
  assistants: AuditUserRef[];
  signer1: AuditUserRef | null;
  signer2: AuditUserRef | null;
  reportNumber: string | null;
  reportDate: string | null;
  issueDeadline: {
    currentDue: string;
    originalDue: string;
    result: DeadlineResult;
    days: number;
    extended: boolean;
  } | null;
  deadlineFlags: { overdue: boolean; dueSoon: boolean; late: boolean; extended: boolean };
  dossier: {
    clientDeliveryStatus: ClientDeliveryStatus;
    originalFilingStatus: OriginalFilingStatus;
    acceptanceStatus: AcceptanceStatus;
  };
  invoice: 'NONE' | 'REQUESTED' | 'ISSUED';
  /** Không có khi người dùng thiếu quyền tài chính. */
  amount?: string;
  totalContractValue?: string;
  paidAmount?: string;
  remainingAmount?: string;
}

export interface BoardResult {
  items: BoardRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    total: number;
    byStage: Record<AuditStage, number>;
    overdue: number;
    dueSoon: number;
    totalContractValue?: string;
    paidAmount?: string;
    remainingAmount?: string;
  };
}

export interface PeopleQuery {
  from?: string | null;
  to?: string | null;
  role?: 'MANAGER' | 'LEAD' | 'SIGNER1' | null;
  kind?: DeadlineKind | null;
  serviceTypeId?: string | null;
}

export interface PeopleSummary {
  total: number;
  onTime: number;
  late: number;
  overdue: number;
  dueSoon: number;
  rate: number | null;
  onTimeOriginal: number;
  rateOriginal: number | null;
  extensions: number;
  avgLateDays: number | null;
}

export interface PeopleRow extends PeopleSummary {
  user: { id: string; fullName: string; teamId: string | null };
  activeEngagements: number;
}

export interface PersonDetail {
  from: string;
  to: string;
  user: { id: string; fullName: string };
  summary: PeopleSummary;
  items: {
    deadlineId: string;
    kind: DeadlineKind;
    roles: string[];
    contract: { id: string; code: string };
    customer: { id: string; name: string };
    serviceType: { id: string; code: string; name: string };
    period: string | null;
    originalDue: string;
    currentDue: string;
    achievedAt: string | null;
    current: Outcome;
    original: Outcome;
    extensions: number;
    extensionReasons: string[];
  }[];
}

/** API theo dõi HĐ kiểm toán (đặc tả 04-F). */
@Injectable({ providedIn: 'root' })
export class AuditTrackingApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_URL}/contracts`;

  engagements(contractId: string): Observable<ContractAuditView> {
    return this.http.get<ContractAuditView>(`${this.base}/${contractId}/audit-engagements`);
  }

  save(contractId: string, lineId: string, input: TeamInput): Observable<ContractAuditView> {
    return this.http.put<ContractAuditView>(
      `${this.base}/${contractId}/audit-engagements/${lineId}`,
      input,
    );
  }

  stage(
    contractId: string,
    lineId: string,
    input: { stage: AuditStage; revision: number; reason?: string },
  ): Observable<ContractAuditView> {
    return this.http.post<ContractAuditView>(
      `${this.base}/${contractId}/audit-engagements/${lineId}/stage`,
      input,
    );
  }

  issue(
    contractId: string,
    lineId: string,
    input: {
      revision: number;
      reportNumber: string;
      reportDate: string;
      signer1Id?: string | null;
    },
    file: File | null,
  ): Observable<ContractAuditView> {
    const form = new FormData();
    form.append('revision', String(input.revision));
    form.append('reportNumber', input.reportNumber);
    form.append('reportDate', input.reportDate);
    if (input.signer1Id) form.append('signer1Id', input.signer1Id);
    if (file) form.append('file', file);
    return this.http.post<ContractAuditView>(
      `${this.base}/${contractId}/audit-engagements/${lineId}/issue`,
      form,
    );
  }

  priority(
    contractId: string,
    lineId: string,
    priority: TaskPriority,
  ): Observable<ContractAuditView> {
    return this.http.put<ContractAuditView>(
      `${this.base}/${contractId}/audit-engagements/${lineId}/priority`,
      { priority },
    );
  }

  note(contractId: string, lineId: string, content: string): Observable<ContractAuditView> {
    return this.http.post<ContractAuditView>(
      `${this.base}/${contractId}/audit-engagements/${lineId}/notes`,
      { content },
    );
  }

  reopen(
    contractId: string,
    lineId: string,
    input: { revision: number; reason: string },
  ): Observable<ContractAuditView> {
    return this.http.post<ContractAuditView>(
      `${this.base}/${contractId}/audit-engagements/${lineId}/reopen`,
      input,
    );
  }

  extend(
    contractId: string,
    lineId: string,
    kind: DeadlineKind,
    input: { revision: number; due: string; reason: string },
  ): Observable<ContractAuditView> {
    return this.http.post<ContractAuditView>(
      `${this.base}/${contractId}/audit-engagements/${lineId}/deadlines/${kind}/extend`,
      input,
    );
  }

  dossier(contractId: string, input: DossierInput): Observable<ContractAuditView> {
    return this.http.put<ContractAuditView>(`${this.base}/${contractId}/dossier`, input);
  }

  board(query: BoardQuery): Observable<BoardResult> {
    return this.http.get<BoardResult>(`${this.base}/audit-tracking`, {
      params: toParams({ ...query }),
    });
  }

  people(query: PeopleQuery): Observable<{ from: string; to: string; items: PeopleRow[] }> {
    return this.http.get<{ from: string; to: string; items: PeopleRow[] }>(
      `${this.base}/audit-tracking/people`,
      {
        params: toParams({ ...query }),
      },
    );
  }

  person(userId: string, query: PeopleQuery): Observable<PersonDetail> {
    return this.http.get<PersonDetail>(`${this.base}/audit-tracking/people/${userId}`, {
      params: toParams({ ...query }),
    });
  }
}
