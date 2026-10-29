import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../../core/auth/auth.service';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { AmendmentEditorComponent } from '../../components/amendment-editor/amendment-editor.component';
import { AMENDMENT_ACTIONS, AMENDMENT_STATUS, AMENDMENT_TEXT } from '../../contract-lifecycle.text';
import { Amendment, AmendmentInput, AmendmentLine } from '../../data-access/contract-lifecycle.api';
import { ContractAmendmentsStore } from '../../data-access/contract-amendments.store';
import { ContractDetail } from '../../data-access/contracts.api';

/** HĐ đã duyệt, chưa thanh lý/huỷ mới lập phụ lục (khớp API). */
const AMENDABLE = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];

/** Phụ lục HĐ (đặc tả 04-D, E6): lập, gửi duyệt, giám đốc duyệt/trả lại; duyệt xong trang HĐ tải lại. */
@Component({
  selector: 'app-contract-amendments-panel',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCollapseModule,
    NzInputModule,
    NzModalModule,
    NzTableModule,
    NzTagModule,
    VndPipe,
    AmendmentEditorComponent,
  ],
  templateUrl: './contract-amendments.panel.html',
  styles: `
    h3 {
      margin: 0 0 4px;
      font-size: 16px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .totals {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin: 8px 0;
    }
  `,
  providers: [ContractAmendmentsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractAmendmentsPanel {
  readonly contract = input.required<ContractDetail>();
  /** Duyệt phụ lục đổi dòng dịch vụ/tổng tiền → trang HĐ tải lại. */
  readonly changed = output<void>();

  protected readonly store = inject(ContractAmendmentsStore);
  protected readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  protected readonly text = AMENDMENT_TEXT;
  protected readonly statusLabels = AMENDMENT_STATUS;
  protected readonly actionLabels = AMENDMENT_ACTIONS;
  protected readonly canEdit = computed(
    () => this.auth.can('contracts:update') && AMENDABLE.includes(this.contract().status),
  );
  protected readonly canApprove = computed(() => this.auth.can('contracts:approve'));
  protected readonly finance = computed(() => this.auth.can('finance:view'));
  /** Form đang mở: `null` đóng, `'new'` lập mới, hoặc phụ lục nháp đang sửa. */
  protected readonly editing = signal<Amendment | 'new' | null>(null);
  protected readonly returning = signal<Amendment | null>(null);
  protected readonly returnReason = signal('');
  protected readonly isAdd = (line: AmendmentLine) => line.action === 'ADD';

  constructor() {
    effect(() => {
      const id = this.contract().id;
      untracked(() => void this.store.load(id));
    });
  }

  protected initialOf(editing: Amendment | 'new'): Amendment | null {
    return editing === 'new' ? null : editing;
  }

  protected open(amendment: Amendment | 'new'): void {
    void this.store.loadServiceTypes();
    this.editing.set(amendment);
  }

  protected async save(input: AmendmentInput): Promise<void> {
    const editing = this.editing();
    const id = editing && editing !== 'new' ? editing.id : undefined;
    if (await this.store.save(input, id)) {
      this.message.success(this.text.saved);
      this.editing.set(null);
    }
  }

  protected async act(amendment: Amendment, action: 'submit' | 'cancel'): Promise<void> {
    const done = action === 'submit' ? this.text.submitted : this.text.cancelled;
    if (await this.store.act(amendment.id, action)) this.message.success(done);
  }

  protected approve(amendment: Amendment): void {
    this.modal.confirm({
      nzTitle: this.text.confirmApprove,
      nzOkText: this.text.confirm,
      nzCancelText: this.text.close,
      nzOnOk: async () => {
        if (await this.store.act(amendment.id, 'approve')) {
          this.message.success(this.text.approved);
          this.changed.emit();
        }
      },
    });
  }

  protected openReturn(amendment: Amendment): void {
    this.returnReason.set('');
    this.returning.set(amendment);
  }

  protected async confirmReturn(): Promise<void> {
    const amendment = this.returning();
    const reason = this.returnReason().trim();
    if (!amendment || reason.length < 5) return;
    if (await this.store.returnToDraft(amendment.id, reason)) {
      this.message.success(this.text.returned);
      this.returning.set(null);
    }
  }
}
