import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import type {
  ObligationType,
  PreviewResult,
  RuleInput,
} from '../data-access/deadline-settings.api';
import { CYCLE_LABELS, GROUP_LABELS, SETTINGS_TEXT } from '../deadline-settings.text';
import { ruleSummary } from '../rule-summary';
import { ObligationRuleFormComponent } from './obligation-rule-form.component';

interface Option {
  id: string;
  label: string;
}

/**
 * Chi tiết một loại nghĩa vụ (I1): quy tắc đã xác nhận / nháp, sửa nháp, xác nhận, ngừng, gắn dịch
 * vụ (I4), xem trước hạn 12 kỳ cho một KH mẫu. Chỉ phát sự kiện.
 */
@Component({
  selector: 'app-obligation-type-detail',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    ObligationRuleFormComponent,
  ],
  templateUrl: './obligation-type-detail.component.html',
  styleUrl: './obligation-type-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObligationTypeDetailComponent {
  readonly type = input.required<ObligationType>();
  readonly serviceOptions = input<Option[]>([]);
  readonly customerOptions = input<Option[]>([]);
  readonly preview = input<PreviewResult | null>(null);
  readonly busy = input(false);
  readonly canCreate = input(false);
  readonly canApprove = input(false);
  readonly saveDraft = output<{ rule: RuleInput; revision?: number }>();
  readonly confirmDraft = output<number>();
  readonly retire = output<string>();
  readonly saveServices = output<string[]>();
  readonly requestPreview = output<string>();

  protected readonly text = SETTINGS_TEXT;
  protected readonly groups = GROUP_LABELS;
  protected readonly cycles = CYCLE_LABELS;
  protected readonly summary = ruleSummary;
  protected readonly editing = signal(false);
  protected readonly retiring = signal(false);
  protected readonly reason = signal('');
  protected readonly services = signal<string[]>([]);
  protected readonly previewCustomer = signal<string | null>(null);

  protected readonly draft = computed(
    () => this.type().versions.find((v) => v.status === 'DRAFT') ?? null,
  );
  protected readonly confirmed = computed(
    () => this.type().versions.find((v) => v.status === 'CONFIRMED') ?? null,
  );
  /** Giá trị khởi tạo form: nháp nếu có, không thì bản xác nhận mới nhất. */
  protected readonly formValue = computed(() => this.draft() ?? this.confirmed());
  protected readonly servicesChanged = computed(() => {
    const current = this.type().services.map((s) => s.id).sort();
    const picked = [...this.services()].sort();
    return current.join() !== picked.join();
  });
  protected readonly reasonValid = computed(() => {
    const n = this.reason().trim().length;
    return n >= 5 && n <= 500;
  });

  constructor() {
    // Loại đổi (chọn loại khác hoặc vừa lưu) → đóng form, đồng bộ dịch vụ đang chọn.
    effect(() => {
      const type = this.type();
      this.services.set(type.services.map((s) => s.id));
      this.editing.set(false);
      this.retiring.set(false);
      this.reason.set('');
    });
  }

  protected onSaveDraft(rule: RuleInput): void {
    this.saveDraft.emit({ rule, revision: this.draft()?.revision });
  }

  protected onRetire(): void {
    if (this.reasonValid()) this.retire.emit(this.reason().trim());
  }

  protected onPreview(customerId: string | null): void {
    this.previewCustomer.set(customerId);
    if (customerId) this.requestPreview.emit(customerId);
  }
}
