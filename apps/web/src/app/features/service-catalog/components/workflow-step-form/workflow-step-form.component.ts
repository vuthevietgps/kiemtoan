import { ChangeDetectionStrategy, Component, inject, input, OnInit, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  ObligationTypeOption,
  ScheduleMode,
  WorkflowRole,
  WorkflowStep,
  WorkflowUserOption,
} from '../../data-access/workflows.api';
import { WORKFLOW_ROLE_OPTIONS, WORKFLOW_TEXT } from '../../workflow.text';

/** Form sửa một bước. Chỉ nhận input, phát bước đã sửa; không gọi API. */
@Component({
  selector: 'app-workflow-step-form',
  imports: [ReactiveFormsModule, NzFormModule, NzInputModule, NzInputNumberModule, NzSelectModule, NzCheckboxModule, NzButtonModule],
  templateUrl: './workflow-step-form.component.html',
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 16px; }
    nz-input-number, nz-select { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowStepFormComponent implements OnInit {
  readonly step = input.required<WorkflowStep>();
  readonly mode = input.required<ScheduleMode>();
  /** Các bước khác trong phiên bản, để chọn bước phải chờ. */
  readonly others = input<WorkflowStep[]>([]);
  /** Bước đứng trước, để chép phụ thuộc khi làm song song. */
  readonly previous = input<WorkflowStep | null>(null);
  /** Nhân sự đang hoạt động để chọn người mặc định (tuỳ chọn). */
  readonly users = input<WorkflowUserOption[]>([]);
  /** Loại nghĩa vụ để gắn bước có hạn pháp lý (06, I6). */
  readonly obligationTypes = input<ObligationTypeOption[]>([]);
  readonly submitted = output<WorkflowStep>();
  readonly cancelled = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly text = WORKFLOW_TEXT;
  protected readonly roleOptions = WORKFLOW_ROLE_OPTIONS;

  protected readonly form = this.fb.group({
    phase: [''],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    instructions: [''],
    required: [true],
    durationDays: new FormControl<number | null>(null, [Validators.min(1), Validators.max(365)]),
    dueOffsetDays: new FormControl<number | null>(null, [Validators.min(-365), Validators.max(365)]),
    performerRole: new FormControl<WorkflowRole | null>(null),
    reviewLevels: [0, [Validators.min(0), Validators.max(2)]],
    reviewerRole: new FormControl<WorkflowRole | null>(null),
    defaultAssigneeId: new FormControl<string | null>(null),
    defaultReviewerId: new FormControl<string | null>(null),
    defaultApproverId: new FormControl<string | null>(null),
    requiresEvidence: [true],
    isStatutory: [false],
    requiresDelivery: [false],
    obligationTypeId: new FormControl<string | null>(null),
    evidenceHint: [''],
    dependsOn: new FormControl<string[]>([], { nonNullable: true }),
  });

  constructor() {
    // H1: bước có hạn pháp lý mặc định cần xác nhận giao nộp (người dùng vẫn bỏ chọn được).
    this.form.controls.isStatutory.valueChanges.pipe(takeUntilDestroyed()).subscribe((on) => {
      if (on && !this.form.controls.requiresDelivery.dirty) this.form.controls.requiresDelivery.setValue(true);
    });
  }

  ngOnInit(): void {
    const s = this.step();
    this.form.patchValue({
      phase: s.phase ?? '',
      name: s.name,
      instructions: s.instructions ?? '',
      required: s.required,
      durationDays: s.durationDays,
      dueOffsetDays: s.dueOffsetDays,
      performerRole: s.performerRole,
      reviewLevels: s.reviewLevels,
      reviewerRole: s.reviewerRole,
      defaultAssigneeId: s.defaultAssigneeId,
      defaultReviewerId: s.defaultReviewerId,
      defaultApproverId: s.defaultApproverId,
      requiresEvidence: s.requiresEvidence,
      isStatutory: !!s.isStatutory,
      requiresDelivery: !!s.requiresDelivery,
      obligationTypeId: s.obligationTypeId ?? null,
      evidenceHint: s.evidenceHint ?? '',
      dependsOn: [...s.dependsOn],
    });
  }

  /** Song song với bước trước = chờ cùng các bước mà bước trước đang chờ. */
  protected parallelWithPrevious(): void {
    this.form.controls.dependsOn.setValue([...(this.previous()?.dependsOn ?? [])]);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitted.emit({
      ...this.step(),
      phase: v.phase.trim() || null,
      name: v.name.trim(),
      instructions: v.instructions.trim() || null,
      required: v.required,
      durationDays: v.durationDays,
      dueOffsetDays: v.dueOffsetDays,
      performerRole: v.performerRole,
      reviewLevels: v.reviewLevels,
      reviewerRole: v.reviewLevels > 0 ? v.reviewerRole : null,
      defaultAssigneeId: v.defaultAssigneeId,
      defaultReviewerId: v.reviewLevels > 0 ? v.defaultReviewerId : null,
      defaultApproverId: v.reviewLevels > 1 ? v.defaultApproverId : null,
      requiresEvidence: v.requiresEvidence,
      isStatutory: v.isStatutory,
      requiresDelivery: v.requiresDelivery,
      obligationTypeId: v.isStatutory ? v.obligationTypeId : null,
      evidenceHint: v.evidenceHint.trim() || null,
      dependsOn: v.dependsOn,
    });
  }
}
