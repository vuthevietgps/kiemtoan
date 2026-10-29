import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AUDIT_STAGE_LABELS,
  AUDIT_STAGES,
  AUDIT_TEXT,
  DEADLINE_KIND_LABELS,
  DEADLINE_RESULT_LABELS,
} from '../../audit-tracking.text';
import {
  AuditEngagementView,
  AuditStage,
  DeadlineKind,
  TeamInput,
} from '../../data-access/audit-tracking.api';
import { UserOption } from '../../data-access/contracts.api';
import { fromDateString, toDateString } from '../../form-utils';

type Mode = 'back' | 'issue' | 'reopen' | 'extend';
const KINDS: DeadlineKind[] = ['FIELDWORK_END', 'REVIEW_END', 'REPORT_ISSUE'];
const REASON_MIN = 5;

/**
 * Một hồ sơ kiểm toán (04-F): nhóm, người ký, hạn, giai đoạn, phát hành/mở lại, gia hạn, dòng thời
 * gian. Chỉ nhận input và phát output; panel cha gọi API và truyền lại dữ liệu mới.
 */
@Component({
  selector: 'app-audit-engagement-card',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './audit-engagement-card.component.html',
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .head h3 {
      margin: 0;
      font-size: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px 16px;
      margin: 12px 0;
    }
    .grid label {
      display: block;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.55);
      margin-bottom: 2px;
    }
    .grid nz-select,
    .grid nz-date-picker {
      width: 100%;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0 12px;
    }
    .muted {
      color: rgba(0, 0, 0, 0.55);
      font-size: 12px;
    }
    .timeline {
      margin: 0;
      padding-left: 18px;
    }
    .modal-field {
      margin-bottom: 12px;
    }
    .modal-field label {
      display: block;
      margin-bottom: 4px;
    }
    .modal-field nz-select,
    .modal-field nz-date-picker {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditEngagementCardComponent {
  readonly item = input.required<AuditEngagementView>();
  readonly users = input<UserOption[]>([]);
  readonly busy = input(false);
  readonly saveTeam = output<TeamInput>();
  readonly changeStage = output<{ stage: AuditStage; reason?: string }>();
  readonly issueReport = output<{
    reportNumber: string;
    reportDate: string;
    signer1Id: string | null;
    file: File | null;
  }>();
  readonly reopenReport = output<string>();
  readonly extendDeadline = output<{ kind: DeadlineKind; due: string; reason: string }>();

  protected readonly text = AUDIT_TEXT;
  protected readonly stageLabels = AUDIT_STAGE_LABELS;
  protected readonly kindLabels = DEADLINE_KIND_LABELS;
  protected readonly resultLabels = DEADLINE_RESULT_LABELS;
  protected readonly kinds = KINDS;

  protected readonly managerId = signal<string | null>(null);
  protected readonly leadId = signal<string | null>(null);
  protected readonly signer1Id = signal<string | null>(null);
  protected readonly signer2Id = signal<string | null>(null);
  protected readonly assistantIds = signal<string[]>([]);
  protected readonly dues = signal<Record<DeadlineKind, Date | null>>({
    FIELDWORK_END: null,
    REVIEW_END: null,
    REPORT_ISSUE: null,
  });

  protected readonly mode = signal<Mode | null>(null);
  protected readonly reason = signal('');
  protected readonly backTo = signal<AuditStage | null>(null);
  protected readonly extendKind = signal<DeadlineKind>('REPORT_ISSUE');
  protected readonly newDue = signal<Date | null>(null);
  protected readonly reportNumber = signal('');
  protected readonly reportDate = signal<Date | null>(new Date());
  protected readonly issueSigner = signal<string | null>(null);
  protected file: File | null = null;

  protected readonly e = computed(() => this.item().engagement);
  /** Danh sách chọn người: tài khoản đang hoạt động + người đang giữ vai (kể cả đã nghỉ) để không mất tên. */
  protected readonly options = computed(() => {
    const e = this.e();
    const current = [e.manager, e.lead, e.signer1, e.signer2, ...e.assistants].filter((u) => !!u);
    const map = new Map(this.users().map((u) => [u.id, { id: u.id, label: u.fullName }]));
    for (const u of current)
      if (!map.has(u!.id))
        map.set(u!.id, { id: u!.id, label: `${u!.fullName} (${this.text.inactive})` });
    return [...map.values()];
  });
  protected readonly unassignedNames = computed(() =>
    this.item()
      .unassigned.map((u) => u.fullName)
      .join(', '),
  );
  protected readonly stageIndex = computed(() => AUDIT_STAGES.indexOf(this.e().stage));
  /** Bước kế tiếp qua API giai đoạn (phát hành có nút riêng). */
  protected readonly nextStage = computed(() => {
    const next = AUDIT_STAGES[this.stageIndex() + 1];
    return next && next !== 'ISSUED' ? next : null;
  });
  protected readonly previousStages = computed(() =>
    this.e().stage === 'ISSUED' ? [] : AUDIT_STAGES.slice(0, this.stageIndex()),
  );
  protected readonly locked = computed(() => this.e().deadlinesLocked);
  protected readonly reasonValid = computed(() => this.reason().trim().length >= REASON_MIN);
  protected readonly modalValid = computed(() => {
    switch (this.mode()) {
      case 'back':
        return !!this.backTo() && this.reasonValid();
      case 'reopen':
        return this.reasonValid();
      case 'extend':
        return !!this.newDue() && this.reasonValid();
      case 'issue':
        return (
          !!this.reportNumber().trim() &&
          !!this.reportDate() &&
          !!(this.issueSigner() ?? this.e().signer1?.id)
        );
      default:
        return false;
    }
  });

  constructor() {
    // Dữ liệu mới (sau khi lưu/tải lại) → điền lại form, đóng hộp thoại.
    effect(() => {
      const item = this.item();
      untracked(() => this.reset(item));
    });
  }

  protected deadline(kind: DeadlineKind) {
    return this.e().deadlines.find((d) => d.kind === kind) ?? null;
  }

  protected setDue(kind: DeadlineKind, value: Date | null): void {
    this.dues.update((d) => ({ ...d, [kind]: value }));
  }

  protected useSuggestion(): void {
    this.setDue('REPORT_ISSUE', fromDateString(this.e().suggestedIssueDue));
  }

  protected submitTeam(): void {
    const dues = this.dues();
    this.saveTeam.emit({
      revision: this.e().revision,
      managerId: this.managerId(),
      leadId: this.leadId(),
      signer1Id: this.signer1Id(),
      signer2Id: this.signer2Id(),
      assistantIds: this.assistantIds(),
      // Sau khi chốt không gửi hạn (đổi hạn phải gia hạn).
      ...(!this.locked() && {
        fieldworkDue: toDateString(dues.FIELDWORK_END),
        reviewDue: toDateString(dues.REVIEW_END),
        issueDue: toDateString(dues.REPORT_ISSUE),
      }),
    });
  }

  protected next(): void {
    const stage = this.nextStage();
    if (stage) this.changeStage.emit({ stage });
  }

  protected open(mode: Mode, kind?: DeadlineKind): void {
    this.reason.set('');
    this.backTo.set(this.previousStages().at(-1) ?? null);
    if (kind) this.extendKind.set(kind);
    this.newDue.set(fromDateString(this.deadline(this.extendKind())?.currentDue));
    this.reportNumber.set(this.e().reportNumber ?? '');
    this.reportDate.set(fromDateString(this.e().reportDate) ?? new Date());
    this.issueSigner.set(this.e().signer1?.id ?? null);
    this.file = null;
    this.mode.set(mode);
  }

  protected onFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected confirm(): void {
    if (!this.modalValid()) return;
    const reason = this.reason().trim();
    switch (this.mode()) {
      case 'back':
        this.changeStage.emit({ stage: this.backTo()!, reason });
        break;
      case 'reopen':
        this.reopenReport.emit(reason);
        break;
      case 'extend':
        this.extendDeadline.emit({
          kind: this.extendKind(),
          due: toDateString(this.newDue())!,
          reason,
        });
        break;
      case 'issue':
        this.issueReport.emit({
          reportNumber: this.reportNumber().trim(),
          reportDate: toDateString(this.reportDate())!,
          signer1Id: this.issueSigner(),
          file: this.file,
        });
        break;
    }
  }

  private reset(item: AuditEngagementView): void {
    const e = item.engagement;
    this.managerId.set(e.manager?.id ?? null);
    this.leadId.set(e.lead?.id ?? null);
    this.signer1Id.set(e.signer1?.id ?? null);
    this.signer2Id.set(e.signer2?.id ?? null);
    this.assistantIds.set(e.assistants.filter((a) => !!a).map((a) => a!.id));
    const due = (kind: DeadlineKind) =>
      fromDateString(e.deadlines.find((d) => d.kind === kind)?.currentDue);
    this.dues.set({
      FIELDWORK_END: due('FIELDWORK_END'),
      REVIEW_END: due('REVIEW_END'),
      REPORT_ISSUE: due('REPORT_ISSUE'),
    });
    this.mode.set(null);
  }
}
