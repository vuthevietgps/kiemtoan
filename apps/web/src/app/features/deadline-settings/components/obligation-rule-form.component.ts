import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { fromDateKey, toDateKey } from '../../../shared/utils/date-key';
import type { Conditions, CreateTypeInput, RuleInput } from '../data-access/deadline-settings.api';
import {
  CONDITION_FIELDS,
  CYCLE_LABELS,
  DUE_RULE_LABELS,
  GROUP_LABELS,
  SETTINGS_TEXT,
  SHIFT_LABELS,
} from '../deadline-settings.text';

const entries = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/**
 * Form quy tắc hạn của loại nghĩa vụ (I1/I3). Chế độ `create` thêm mã, tên, nhóm, chu kỳ. Kiểm tra
 * cuối cùng ở API (400 hiện ở trang); form chỉ chặn lỗi hiển nhiên.
 */
@Component({
  selector: 'app-obligation-rule-form',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
  ],
  templateUrl: './obligation-rule-form.component.html',
  styleUrl: './obligation-rule-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObligationRuleFormComponent {
  readonly mode = input<'create' | 'draft'>('draft');
  /** Chu kỳ của loại đang sửa (chế độ draft). */
  readonly cycle = input<string>('MONTHLY');
  readonly value = input<RuleInput | null>(null);
  readonly busy = input(false);
  readonly created = output<CreateTypeInput>();
  readonly saved = output<RuleInput>();
  readonly cancelled = output<void>();

  protected readonly text = SETTINGS_TEXT;
  protected readonly groups = entries(GROUP_LABELS);
  protected readonly cycles = entries(CYCLE_LABELS);
  protected readonly rules = entries(DUE_RULE_LABELS);
  protected readonly shifts = entries(SHIFT_LABELS);
  protected readonly conditionFields = CONDITION_FIELDS.map((f) => ({
    ...f,
    choices: entries(f.options),
  }));

  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({
    code: ['', [Validators.pattern(/^[A-Za-z0-9_-]{2,30}$/)]],
    name: ['', [Validators.minLength(2), Validators.maxLength(200)]],
    group: ['TAX'],
    family: [''],
    cycle: ['MONTHLY'],
    effectiveFrom: [new Date() as Date | null, Validators.required],
    dueRule: ['MONTH_AFTER_END' as RuleInput['dueRule']],
    monthsAfter: [1 as number | null],
    dueMonth: [null as number | null],
    dueDay: [20, [Validators.required, Validators.min(1), Validators.max(31)]],
    useFiscalYear: [true],
    holidayShift: ['NEXT' as RuleInput['holidayShift']],
    conditions: this.fb.group(
      Object.fromEntries(CONDITION_FIELDS.map((f) => [f.key, [[] as string[]]])),
    ),
    legalBasis: [''],
    note: [''],
  });
  private readonly dueRule = toSignal(this.form.controls.dueRule.valueChanges, {
    initialValue: this.form.controls.dueRule.value,
  });
  private readonly formCycle = toSignal(this.form.controls.cycle.valueChanges, {
    initialValue: this.form.controls.cycle.value,
  });
  protected readonly fixed = computed(() => this.dueRule() === 'FIXED_IN_YEAR');
  /** Ngày cố định trong năm chỉ dùng cho nghĩa vụ theo năm. */
  protected readonly yearly = computed(
    () => (this.mode() === 'create' ? this.formCycle() : this.cycle()) === 'YEARLY',
  );

  constructor() {
    effect(() => {
      const value = this.value();
      if (!value) return;
      untracked(() =>
        this.form.patchValue({
          ...value,
          effectiveFrom: fromDateKey(value.effectiveFrom),
          conditions: Object.fromEntries(
            CONDITION_FIELDS.map((f) => [f.key, value.conditions?.[f.key] ?? []]),
          ),
          legalBasis: value.legalBasis ?? '',
          note: value.note ?? '',
        }),
      );
    });
  }

  protected submit(): void {
    const v = this.form.getRawValue();
    const conditions: Conditions = Object.fromEntries(
      Object.entries(v.conditions).filter(([, list]) => list.length > 0),
    );
    const rule: RuleInput = {
      effectiveFrom: toDateKey(v.effectiveFrom!),
      dueRule: v.dueRule,
      monthsAfter: v.dueRule === 'MONTH_AFTER_END' ? v.monthsAfter : null,
      dueMonth: v.dueRule === 'FIXED_IN_YEAR' ? v.dueMonth : null,
      dueDay: v.dueDay,
      useFiscalYear: v.useFiscalYear,
      holidayShift: v.holidayShift,
      conditions,
      legalBasis: v.legalBasis.trim() || null,
      note: v.note.trim() || null,
    };
    if (this.mode() === 'draft') {
      this.saved.emit(rule);
      return;
    }
    this.created.emit({
      ...rule,
      code: v.code.trim().toUpperCase(),
      name: v.name.trim(),
      group: v.group,
      family: v.family.trim().toUpperCase() || undefined,
      cycle: v.cycle,
    });
  }

  protected invalid(): boolean {
    if (this.form.invalid) return true;
    const v = this.form.getRawValue();
    return this.mode() === 'create' && (!v.code.trim() || v.name.trim().length < 2);
  }
}
