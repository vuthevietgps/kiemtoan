import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import type { TaskPriority } from '../../../tasks/task-labels';
import { AUDIT_TEXT } from '../../audit-tracking.text';
import { AuditEngagementCardComponent } from '../../components/audit-engagement-card/audit-engagement-card.component';
import { AuditNotesComponent } from '../../components/audit-notes/audit-notes.component';
import { ContractDossierCardComponent } from '../../components/contract-dossier-card/contract-dossier-card.component';
import { AuditEngagementsStore } from '../../data-access/audit-engagements.store';
import {
  AuditEngagementView,
  AuditStage,
  DeadlineKind,
  DossierInput,
  TeamInput,
} from '../../data-access/audit-tracking.api';

/**
 * Hồ sơ kiểm toán của một HĐ (đặc tả 04-F): tình trạng hồ sơ HĐ và từng dòng phát hành BCKT.
 * Dùng cho tab Kiểm toán trên chi tiết HĐ và ngăn chi tiết của bảng theo dõi.
 */
@Component({
  selector: 'app-contract-audit-panel',
  imports: [
    NzAlertModule,
    NzSpinModule,
    AuditEngagementCardComponent,
    AuditNotesComponent,
    ContractDossierCardComponent,
  ],
  template: `
    @if (store.error()) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="store.error()" style="margin-bottom: 12px" />
    }
    @if (store.view(); as view) {
      <app-contract-dossier-card
        [dossier]="view.dossier"
        [canEdit]="view.canEditDossier"
        [docs]="store.acceptanceDocs()"
        [busy]="store.busy()"
        (save)="saveDossier($event)"
      />
      @for (item of view.engagements; track item.lineId) {
        <app-audit-engagement-card
          [item]="item"
          [users]="store.users()"
          [busy]="store.busy()"
          (saveTeam)="saveTeam(item, $event)"
          (changeStage)="changeStage(item, $event)"
          (issueReport)="issue(item, $event)"
          (reopenReport)="reopen(item, $event)"
          (extendDeadline)="extend(item, $event)"
        />
        <app-audit-notes
          [item]="item"
          [busy]="store.busy()"
          (setPriority)="setPriority(item, $event)"
          (addNote)="addNote(item, $event)"
        />
      } @empty {
        <div class="panel text-muted">{{ text.noAudit }}</div>
      }
    } @else if (store.loading()) {
      <div class="panel" style="text-align: center"><nz-spin nzSimple /></div>
    }
  `,
  providers: [AuditEngagementsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractAuditPanel {
  readonly contractId = input.required<string>();
  /** Báo cho trang cha khi dữ liệu đổi (bảng theo dõi tải lại dòng). */
  readonly changed = output<void>();

  protected readonly store = inject(AuditEngagementsStore);
  private readonly message = inject(NzMessageService);
  protected readonly text = AUDIT_TEXT;

  constructor() {
    effect(() => {
      const id = this.contractId();
      untracked(() => void this.store.load(id));
    });
  }

  protected saveTeam(item: AuditEngagementView, input: TeamInput): void {
    void this.done(this.store.save(item.lineId, input), this.text.saved);
  }

  protected changeStage(
    item: AuditEngagementView,
    event: { stage: AuditStage; reason?: string },
  ): void {
    void this.done(
      this.store.stage(item.lineId, item.engagement.revision, event.stage, event.reason),
    );
  }

  protected issue(
    item: AuditEngagementView,
    event: {
      reportNumber: string;
      reportDate: string;
      signer1Id: string | null;
      file: File | null;
    },
  ): void {
    const { file, ...input } = event;
    void this.done(
      this.store.issue(item.lineId, { revision: item.engagement.revision, ...input }, file),
    );
  }

  protected reopen(item: AuditEngagementView, reason: string): void {
    void this.done(this.store.reopen(item.lineId, item.engagement.revision, reason));
  }

  protected extend(
    item: AuditEngagementView,
    event: { kind: DeadlineKind; due: string; reason: string },
  ): void {
    void this.done(
      this.store.extend(item.lineId, event.kind, {
        revision: item.engagement.revision,
        due: event.due,
        reason: event.reason,
      }),
    );
  }

  protected setPriority(item: AuditEngagementView, priority: TaskPriority): void {
    void this.done(this.store.priority(item.lineId, priority));
  }

  protected async addNote(
    item: AuditEngagementView,
    event: { content: string; saved: () => void },
  ): Promise<void> {
    const ok = await this.store.note(item.lineId, event.content);
    if (ok) event.saved();
    await this.done(Promise.resolve(ok), this.text.noteSaved);
  }

  protected saveDossier(input: DossierInput): void {
    void this.done(this.store.dossier(input), this.text.dossierSaved);
  }

  private async done(action: Promise<boolean>, success: string = this.text.done): Promise<void> {
    if (await action) {
      this.message.success(success);
      this.changed.emit();
    } else if (this.store.error()) {
      this.message.error(this.store.error());
    }
  }
}
