import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzTableModule } from 'ng-zorro-antd/table';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../../core/api/api';
import { TASK_PRIORITY_LABELS, TaskPriority } from '../../../tasks/task-labels';
import { AUDIT_STAGE_LABELS } from '../../audit-tracking.text';
import { AuditStage } from '../../data-access/audit-tracking.api';
import { CONTRACT_STATUS_LABELS, ContractStatus } from '../../contract-labels';
import {
  AMENDMENT_STATUS,
  HISTORY_ACTIONS,
  HISTORY_PATHS,
  LIFECYCLE_TEXT,
} from '../../contract-lifecycle.text';
import {
  AmendmentStatus,
  ContractLifecycleApi,
  HistoryEntry,
} from '../../data-access/contract-lifecycle.api';

/** Tên trường thông tin kinh doanh trong lịch sử. */
const FIELD_LABELS: Record<string, string> = {
  ownerId: LIFECYCLE_TEXT.owner,
  salesOwnerId: LIFECYCLE_TEXT.salesOwner,
  referrerName: LIFECYCLE_TEXT.referrerName,
  referrerPhone: LIFECYCLE_TEXT.referrerPhone,
  referrerNote: LIFECYCLE_TEXT.referrerNote,
  signedDate: LIFECYCLE_TEXT.signedDate,
  note: LIFECYCLE_TEXT.note,
};

/** Tab Lịch sử của HĐ (PL1 VII.3): duyệt, trả lại, phụ lục, kế hoạch, hồ sơ, sửa thông tin — không có số tiền. */
@Component({
  selector: 'app-contract-history-panel',
  imports: [DatePipe, NzAlertModule, NzPaginationModule, NzTableModule],
  template: `
    @if (error(); as message) {
      <nz-alert nzType="error" [nzMessage]="message" />
    }
    <nz-table
      [nzData]="items()"
      [nzLoading]="loading()"
      [nzShowPagination]="false"
      [nzFrontPagination]="false"
      nzSize="small"
      [nzScroll]="{ x: '640px' }"
      [nzNoResult]="text.historyEmpty"
    >
      <thead>
        <tr>
          <th nzWidth="140px">{{ text.time }}</th>
          <th nzWidth="160px">{{ text.user }}</th>
          <th nzWidth="170px">{{ text.action }}</th>
          <th>{{ text.content }}</th>
        </tr>
      </thead>
      <tbody>
        @for (h of items(); track h.id) {
          <tr>
            <td>{{ h.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td>{{ h.user?.fullName ?? '—' }}</td>
            <td>{{ actionLabel(h) }}</td>
            <td>{{ describe(h) }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (total() > 20) {
      <nz-pagination
        [nzPageIndex]="page()"
        [nzTotal]="total()"
        [nzPageSize]="20"
        (nzPageIndexChange)="load($event)"
        style="margin-top: 8px"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractHistoryPanel {
  readonly contractId = input.required<string>();
  private readonly api = inject(ContractLifecycleApi);
  protected readonly text = LIFECYCLE_TEXT;
  protected readonly items = signal<HistoryEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private request = 0;

  constructor() {
    effect(() => {
      this.contractId();
      untracked(() => void this.load(1));
    });
  }

  protected async load(page: number): Promise<void> {
    const request = ++this.request;
    this.page.set(page);
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(this.api.history(this.contractId(), page));
      if (request !== this.request) return;
      this.items.set(result.items);
      this.total.set(result.total);
    } catch (err) {
      if (request === this.request) this.error.set(errorMessage(err));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  /** Bản ghi chung (có đường dẫn API) lấy nhãn theo đường dẫn; bản ghi nghiệp vụ theo mã thao tác. */
  protected actionLabel(entry: HistoryEntry): string {
    const path = entry.detail['path'];
    const generic =
      typeof path === 'string' ? HISTORY_PATHS.find(([pattern]) => pattern.test(path)) : undefined;
    return generic?.[1] ?? HISTORY_ACTIONS[entry.action] ?? entry.action;
  }

  /** Tóm tắt nội dung từ các khoá an toàn API trả về. */
  protected describe(entry: HistoryEntry): string {
    const d = entry.detail;
    const status = (value: unknown) =>
      CONTRACT_STATUS_LABELS[value as ContractStatus] ??
      AMENDMENT_STATUS[value as AmendmentStatus]?.label ??
      // 04-F: giai đoạn BCKT và mức độ hồ sơ kiểm toán.
      AUDIT_STAGE_LABELS[value as AuditStage]?.label ??
      TASK_PRIORITY_LABELS[value as TaskPriority] ??
      String(value);
    const parts: string[] = [];
    if (d['number']) parts.push(`${String(d['number'])} ${String(d['title'] ?? '')}`.trim());
    if (d['from'] && d['to']) parts.push(`${status(d['from'])} → ${status(d['to'])}`);
    if (d['newCode']) parts.push(String(d['newCode']));
    if (Array.isArray(d['fields']))
      parts.push(d['fields'].map((f) => FIELD_LABELS[String(f)] ?? String(f)).join(', '));
    if (d['reason']) parts.push(`“${String(d['reason'])}”`);
    return parts.join(' · ');
  }
}
