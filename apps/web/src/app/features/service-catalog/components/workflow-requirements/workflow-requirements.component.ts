import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DOCUMENT_CATEGORY_LABELS, DocumentCategory } from '../../../customers/customer-labels';
import { DocumentRequirement, WorkflowStep } from '../../data-access/workflows.api';
import { WORKFLOW_TEXT } from '../../workflow.text';

/**
 * Danh sách hồ sơ yêu cầu của phiên bản: thêm/sửa/xoá/sắp xếp và phát ra danh sách mới.
 * Không gọi API; trang lưu cùng bản nháp.
 */
@Component({
  selector: 'app-workflow-requirements',
  imports: [ReactiveFormsModule, NzFormModule, NzInputModule, NzSelectModule, NzCheckboxModule, NzButtonModule, NzIconModule, NzTableModule, NzTagModule],
  templateUrl: './workflow-requirements.component.html',
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 16px; }
    nz-select { width: 100%; }
    .error { color: #ff4d4f; font-size: 12px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowRequirementsComponent {
  readonly requirements = input.required<DocumentRequirement[]>();
  readonly steps = input.required<WorkflowStep[]>();
  readonly readonly = input(false);
  readonly changed = output<DocumentRequirement[]>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly text = WORKFLOW_TEXT;
  protected readonly categoryLabels = DOCUMENT_CATEGORY_LABELS;
  protected readonly categories = Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[];
  protected readonly stepNames = computed(() => new Map(this.steps().map((s) => [s.key, `${s.key} — ${s.name}`])));
  /** Vị trí hồ sơ đang sửa; null = đang thêm mới. */
  protected readonly editing = signal<number | null>(null);
  protected readonly duplicate = signal(false);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    category: ['SERVICE' as DocumentCategory],
    required: [true],
    perPeriod: [false],
    stepKey: new FormControl<string | null>(null),
    instructions: ['', Validators.maxLength(1000)],
  });

  protected edit(index: number): void {
    const r = this.requirements()[index];
    this.form.setValue({
      name: r.name,
      category: r.category,
      required: r.required,
      perPeriod: r.perPeriod,
      stepKey: r.stepKey,
      instructions: r.instructions ?? '',
    });
    this.editing.set(index);
  }

  protected reset(): void {
    this.form.reset();
    this.editing.set(null);
    this.duplicate.set(false);
  }

  protected submit(): void {
    const v = this.form.getRawValue();
    const name = v.name.trim();
    const index = this.editing();
    const clash = this.requirements().some(
      (r, i) => i !== index && r.name.trim().toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'),
    );
    this.duplicate.set(clash);
    if (this.form.invalid || name.length < 2 || clash) {
      this.form.markAllAsTouched();
      return;
    }
    const item: DocumentRequirement = { ...v, name, instructions: v.instructions.trim() || null };
    const list = [...this.requirements()];
    if (index === null) list.push(item);
    else list[index] = item;
    this.changed.emit(list);
    this.reset();
  }

  protected move(index: number, delta: -1 | 1): void {
    const list = [...this.requirements()];
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    this.changed.emit(list);
  }

  protected remove(index: number): void {
    this.changed.emit(this.requirements().filter((_, i) => i !== index));
    if (this.editing() === index) this.reset();
  }
}
