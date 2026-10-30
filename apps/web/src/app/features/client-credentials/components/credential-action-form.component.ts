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
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { toDateKey } from '../../../shared/utils/date-key';
import { CREDENTIAL_STATUS_LABELS } from '../../customers/customer-labels';
import { CREDENTIALS_TEXT, CredentialDialog, MAX_LOAN_DAYS } from '../client-credentials.text';
import type { ClientCredential, Person } from '../data-access/client-credentials.api';
import type { CredentialAction } from '../data-access/credentials.store';

const DAY_MS = 86_400_000;

/** Hạn trả mặc định (L4): hết ngày làm việc kế tiếp (bỏ thứ 7, chủ nhật). */
export function defaultLoanDue(today: Date = new Date()): Date {
  let next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) next = new Date(next.getTime() + DAY_MS);
  return next;
}

/**
 * Biểu mẫu một thao tác (09-D): báo lỗi (L7), mượn / giao (hạn trả ≤ 30 ngày — L4), trả, cất tại văn
 * phòng / trả khách, xoá có lý do (L10). Chỉ phát `submitted`; máy chủ kiểm lại mọi điều kiện.
 */
@Component({
  selector: 'app-credential-action-form',
  imports: [FormsModule, NzButtonModule, NzDatePickerModule, NzInputModule, NzSelectModule],
  template: `
    <form class="form" (ngSubmit)="submit()">
      @if (mode() === 'report') {
        <label>
          {{ text.issueStatus }}
          <nz-select name="status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <nz-option nzValue="ERROR" [nzLabel]="statusLabels.ERROR" />
            <nz-option nzValue="NEED_CHANGE" [nzLabel]="statusLabels.NEED_CHANGE" />
          </nz-select>
        </label>
      }
      @if (mode() === 'handOver') {
        <label>
          {{ text.receiver }}
          <nz-select
            name="holder"
            nzShowSearch
            [ngModel]="holderId()"
            (ngModelChange)="holderId.set($event)"
          >
            @for (u of receivers(); track u.id) {
              <nz-option [nzValue]="u.id" [nzLabel]="u.fullName" />
            }
          </nz-select>
        </label>
      }
      @if (mode() === 'borrow' || mode() === 'handOver') {
        <label>
          {{ text.loanDue }}
          <nz-date-picker
            name="due"
            nzFormat="dd/MM/yyyy"
            [nzDisabledDate]="outOfRange"
            [ngModel]="due()"
            (ngModelChange)="due.set($event)"
          />
        </label>
      }
      @if (mode() === 'return' || mode() === 'office') {
        <label>
          {{ text.location }}
          <input
            nz-input
            name="location"
            maxlength="200"
            [ngModel]="location()"
            (ngModelChange)="location.set($event)"
          />
        </label>
      }
      <label>
        {{ noteLabel() }}
        <textarea
          nz-input
          name="note"
          rows="2"
          maxlength="1000"
          [ngModel]="note()"
          (ngModelChange)="note.set($event)"
        ></textarea>
      </label>
      <div class="actions">
        <button nz-button type="button" (click)="cancelled.emit()">{{ text.cancel }}</button>
        <button
          nz-button
          nzType="primary"
          type="submit"
          [nzDanger]="mode() === 'delete'"
          [disabled]="!valid()"
          [nzLoading]="busy()"
        >
          {{ text.confirm }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      label {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialActionFormComponent {
  readonly mode = input.required<CredentialDialog>();
  readonly credential = input<ClientCredential | null>(null);
  readonly users = input<Person[]>([]);
  readonly busy = input(false);
  readonly submitted = output<CredentialAction>();
  readonly cancelled = output<void>();

  protected readonly text = CREDENTIALS_TEXT;
  protected readonly statusLabels = CREDENTIAL_STATUS_LABELS;
  protected readonly status = signal<'ERROR' | 'NEED_CHANGE'>('ERROR');
  protected readonly holderId = signal<string | null>(null);
  protected readonly due = signal<Date | null>(defaultLoanDue());
  protected readonly location = signal('');
  protected readonly note = signal('');

  /** Ghi chú bắt buộc khi báo lỗi; lý do bắt buộc khi xoá. */
  private readonly noteRequired = computed(() => ['report', 'delete'].includes(this.mode()));
  protected readonly noteLabel = computed(() => {
    if (this.mode() === 'delete') return `${this.text.reason} *`;
    if (this.mode() === 'report') return `${this.text.note} *`;
    return this.mode() === 'borrow' || this.mode() === 'handOver'
      ? this.text.purpose
      : this.text.note;
  });
  protected readonly receivers = computed(() =>
    this.users().filter((u) => u.id !== this.credential()?.holder?.id),
  );
  protected readonly valid = computed(() => {
    if (this.noteRequired() && !this.note().trim()) return false;
    if (this.mode() === 'handOver' && !this.holderId()) return false;
    if (['borrow', 'handOver'].includes(this.mode()) && !this.due()) return false;
    return true;
  });

  constructor() {
    effect(() => {
      this.mode();
      this.status.set('ERROR');
      this.holderId.set(null);
      this.due.set(defaultLoanDue());
      this.location.set(this.credential()?.storageLocation ?? '');
      this.note.set('');
    });
  }

  protected readonly outOfRange = (date: Date): boolean => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date < start || date.getTime() > start.getTime() + (MAX_LOAN_DAYS + 1) * DAY_MS - 1;
  };

  protected submit(): void {
    if (!this.valid()) return;
    const note = this.note().trim() || null;
    const location = this.location().trim() || null;
    const dueDate = this.due() ? toDateKey(this.due()!) : '';
    const action = ((): CredentialAction => {
      switch (this.mode()) {
        case 'report':
          return { kind: 'report', status: this.status(), note: note ?? '' };
        case 'borrow':
          return { kind: 'borrow', dueDate, purpose: note };
        case 'handOver':
          return { kind: 'handOver', holderId: this.holderId()!, dueDate, purpose: note };
        case 'return':
          return { kind: 'return', storageLocation: location, note };
        case 'office':
          return { kind: 'custody', custody: 'OFFICE', storageLocation: location, note };
        case 'customer':
          return { kind: 'custody', custody: 'CUSTOMER', storageLocation: null, note };
        case 'delete':
          return { kind: 'delete', reason: note ?? '' };
      }
    })();
    this.submitted.emit(action);
  }
}
