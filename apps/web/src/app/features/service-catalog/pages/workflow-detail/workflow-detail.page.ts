import { moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { toDateString } from '../../../contracts/form-utils';
import { WorkflowPreviewComponent } from '../../components/workflow-preview.component';
import { WorkflowRequirementsComponent } from '../../components/workflow-requirements/workflow-requirements.component';
import { WorkflowStepFormComponent } from '../../components/workflow-step-form/workflow-step-form.component';
import { WorkflowStepsTableComponent } from '../../components/workflow-steps-table/workflow-steps-table.component';
import { nextStepKey, withoutStep, WorkflowEditorStore } from '../../data-access/workflow-editor.store';
import { WorkflowStep } from '../../data-access/workflows.api';
import { SCHEDULE_MODE_LABELS, WORKFLOW_STATUS, WORKFLOW_TEXT } from '../../workflow.text';

/** Quy trình mẫu: lịch sử phiên bản, sửa bản nháp, xem trước lịch và phát hành. */
@Component({
  selector: 'app-workflow-detail-page',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    CanDirective,
    WorkflowStepsTableComponent,
    WorkflowStepFormComponent,
    WorkflowPreviewComponent,
    WorkflowRequirementsComponent,
  ],
  templateUrl: './workflow-detail.page.html',
  providers: [WorkflowEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowDetailPage implements OnInit {
  /** Tham số route :id (quy trình). */
  readonly id = input.required<string>();

  protected readonly store = inject(WorkflowEditorStore);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  protected readonly text = WORKFLOW_TEXT;
  protected readonly statusLabels = WORKFLOW_STATUS;
  protected readonly modeOptions = Object.entries(SCHEDULE_MODE_LABELS).map(([value, label]) => ({ value, label }));
  /** Khoá bước đang sửa trong ngăn bên phải. */
  protected readonly editingKey = signal<string | null>(null);
  protected readonly editingStep = computed(() => this.store.steps().find((s) => s.key === this.editingKey()) ?? null);
  protected readonly otherSteps = computed(() => this.store.steps().filter((s) => s.key !== this.editingKey()));
  protected readonly editingIndex = computed(() => this.store.steps().findIndex((s) => s.key === this.editingKey()));
  protected previewStart: Date | null = new Date();
  protected previewPeriod = '';

  ngOnInit(): void {
    void this.store.load(this.id());
  }

  protected addStep(): void {
    const steps = this.store.steps();
    const last = steps.at(-1);
    const step: WorkflowStep = {
      key: nextStepKey(steps),
      phase: last?.phase ?? null,
      name: `Bước ${steps.length + 1}`,
      instructions: null,
      required: true,
      durationDays: this.store.scheduleMode() === 'PROJECT' ? 1 : null,
      dueOffsetDays: this.store.scheduleMode() === 'PERIODIC' ? 0 : null,
      performerRole: 'STAFF',
      defaultAssigneeId: null,
      reviewLevels: 1,
      reviewerRole: 'MANAGER',
      defaultReviewerId: null,
      defaultApproverId: null,
      requiresEvidence: true,
      evidenceHint: null,
      dependsOn: last ? [last.key] : [],
    };
    this.store.setSteps([...steps, step]);
    this.editingKey.set(step.key);
  }

  protected applyStep(step: WorkflowStep): void {
    this.store.setSteps(this.store.steps().map((s) => (s.key === step.key ? step : s)));
    this.editingKey.set(null);
  }

  protected move(event: { key: string; delta: -1 | 1 }): void {
    const steps = [...this.store.steps()];
    const index = steps.findIndex((s) => s.key === event.key);
    const target = index + event.delta;
    if (index < 0 || target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    this.store.setSteps(steps);
  }

  protected reorder(event: { from: number; to: number }): void {
    const steps = [...this.store.steps()];
    moveItemInArray(steps, event.from, event.to);
    this.store.setSteps(steps);
  }

  protected removeStep(key: string): void {
    this.store.setSteps(withoutStep(this.store.steps(), key));
    // Hồ sơ gắn bước vừa xoá chuyển thành không gắn bước.
    if (this.store.requirements().some((r) => r.stepKey === key))
      this.store.setRequirements(this.store.requirements().map((r) => (r.stepKey === key ? { ...r, stepKey: null } : r)));
  }

  protected async save(): Promise<void> {
    if (await this.store.save()) this.message.success(this.text.saved);
  }

  protected publish(): void {
    this.confirm(this.text.confirmPublish, async () => {
      if (await this.store.publish()) this.message.success(this.text.published);
    });
  }

  protected async newDraft(): Promise<void> {
    if (await this.store.cloneToDraft()) this.message.success(this.text.cloned);
  }

  protected removeDraft(): void {
    this.confirm(this.text.confirmRemove, async () => {
      if (await this.store.removeDraft()) this.message.success(this.text.removed);
    });
  }

  /** Hộp xác nhận giữa màn hình (popconfirm bị tràn trên màn hẹp). */
  private confirm(title: string, onOk: () => Promise<void>): void {
    this.modal.confirm({ nzTitle: title, nzOkText: this.text.confirm, nzCancelText: this.text.cancel, nzOnOk: onOk });
  }

  protected async setDefault(): Promise<void> {
    if (await this.store.setDefault()) this.message.success(this.text.defaultSet);
  }

  protected loadPreview(): void {
    void this.store.loadPreview(toDateString(this.previewStart), this.previewPeriod.trim() || null);
  }
}
