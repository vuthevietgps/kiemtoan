import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { TaskDetail, TasksApi } from '../data-access/tasks.api';
import { DUE_CHANGE_LABELS } from '../task-labels';

const REASON_MIN = 5;
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Theo dõi việc (05-D): chờ khách tay/tiếp tục (H4), tạm dừng/tiếp tục và mở lại (H5), đề nghị/duyệt
 * gia hạn (H7), khoảng chờ và xác nhận (G5). Máy chủ kiểm quyền; nút chỉ hiện theo vai dự đoán.
 */
@Component({
  selector: 'app-task-follow-up',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzInputModule,
    NzTagModule,
  ],
  template: `
    @let t = task();
    <div class="box">
      @if (isAssignee() && (t.status === 'NOT_STARTED' || t.status === 'IN_PROGRESS')) {
        <div class="line">
          <input
            nz-input
            nzSize="small"
            placeholder="Hồ sơ cần khách gửi"
            [(ngModel)]="requestName"
          />
          <button
            nz-button
            nzSize="small"
            [disabled]="requestName.trim().length < 2"
            (click)="waitClient()"
          >
            Chuyển Chờ khách
          </button>
        </div>
      }
      @if (t.status === 'WAITING_CLIENT' && (isAssignee() || canManage())) {
        <button nz-button nzSize="small" (click)="run(api.followUp(t.id, 'resume'))">
          Khách đã gửi, tiếp tục
        </button>
      }
      @if (canManage()) {
        <div class="line">
          <input
            nz-input
            nzSize="small"
            placeholder="Lý do (tạm dừng / mở lại)"
            [(ngModel)]="reason"
          />
          @if (t.status === 'ON_HOLD') {
            <button nz-button nzSize="small" (click)="run(api.followUp(t.id, 'unhold'))">
              Tiếp tục
            </button>
          } @else if (t.status === 'COMPLETED') {
            <button
              nz-button
              nzSize="small"
              [disabled]="!reasonOk()"
              (click)="withReason('reopen')"
            >
              Mở lại
            </button>
          } @else {
            <button nz-button nzSize="small" [disabled]="!reasonOk()" (click)="withReason('hold')">
              Tạm dừng
            </button>
          }
        </div>
      }

      <h4>Gia hạn</h4>
      @for (c of t.dueChanges; track c.id) {
        <div class="item">
          {{ c.oldDue | date: 'dd/MM/yyyy' }} → <b>{{ c.newDue | date: 'dd/MM/yyyy' }}</b>
          <nz-tag [nzColor]="dueLabels[c.status].color">{{ dueLabels[c.status].label }}</nz-tag>
          @if (c.documented) {
            <nz-tag>Theo văn bản</nz-tag>
          }
          <div class="muted">{{ c.reason }} · {{ c.requestedBy?.fullName }}</div>
          @if (c.status === 'PENDING' && canManage() && c.requestedBy?.id !== me()) {
            <button
              nz-button
              nzSize="small"
              nzType="primary"
              (click)="run(api.decideDueChange(t.id, c.id, true))"
            >
              Duyệt
            </button>
            <button
              nz-button
              nzSize="small"
              nzDanger
              (click)="run(api.decideDueChange(t.id, c.id, false))"
            >
              Từ chối
            </button>
          }
        </div>
      }
      @if (t.status !== 'COMPLETED') {
        <div class="line">
          <nz-date-picker
            nzSize="small"
            nzFormat="dd/MM/yyyy"
            nzPlaceHolder="Hạn mới"
            [(ngModel)]="newDue"
          />
          <input nz-input nzSize="small" placeholder="Lý do gia hạn" [(ngModel)]="dueReason" />
          @if (t.isStatutory && isDirector()) {
            <label nz-checkbox [(ngModel)]="documented">Theo văn bản</label>
          }
          <button
            nz-button
            nzSize="small"
            [disabled]="!newDue || dueReason.trim().length < 5"
            (click)="requestDue()"
          >
            {{ t.isStatutory && !documented ? 'Hạn pháp lý' : 'Đề nghị gia hạn' }}
          </button>
        </div>
      }

      @if (t.clientWaits.length) {
        <h4>Khoảng chờ khách · đã xác nhận {{ t.confirmedWaitDays }} ngày</h4>
        @for (w of t.clientWaits; track w.id) {
          <div class="item">
            {{ w.startedAt | date: 'dd/MM/yyyy' }} →
            {{ w.endedAt ? (w.endedAt | date: 'dd/MM/yyyy') : 'đang chờ' }}
            <span class="muted">· {{ w.automatic ? 'tự động' : 'chuyển tay' }}</span>
            @if (w.confirmedAt) {
              <nz-tag nzColor="green">Đã xác nhận · {{ w.confirmedBy?.fullName }}</nz-tag>
            } @else if (w.endedAt && canManage()) {
              <button nz-button nzSize="small" (click)="run(api.confirmWait(t.id, w.id))">
                Xác nhận
              </button>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .line input {
      width: 200px;
    }
    .item {
      padding: 4px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    h4 {
      margin: 8px 0 0;
    }
    .muted {
      color: rgba(0, 0, 0, 0.55);
      font-size: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFollowUpComponent {
  protected readonly api = inject(TasksApi);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  readonly task = input.required<TaskDetail>();
  readonly isAssignee = input(false);
  /** Có `tasks:approve` (Manager dòng dịch vụ cũng được, máy chủ kiểm). */
  readonly canManage = input(false);
  readonly changed = output<void>();

  protected readonly dueLabels = DUE_CHANGE_LABELS;
  protected readonly me = computed(() => this.auth.user()?.id ?? null);
  protected readonly isDirector = computed(() => this.auth.permissions().has('contracts:approve'));
  protected requestName = '';
  protected reason = '';
  protected newDue: Date | null = null;
  protected dueReason = '';
  protected documented = false;

  protected reasonOk(): boolean {
    return this.reason.trim().length >= REASON_MIN;
  }

  protected waitClient(): void {
    this.run(
      this.api.followUp(this.task().id, 'wait-client', { requestName: this.requestName.trim() }),
    );
  }

  protected withReason(action: 'hold' | 'reopen'): void {
    this.run(this.api.followUp(this.task().id, action, { reason: this.reason.trim() }));
  }

  protected requestDue(): void {
    if (!this.newDue) return;
    this.run(
      this.api.requestDueChange(this.task().id, {
        newDue: toIso(this.newDue),
        reason: this.dueReason.trim(),
        ...(this.documented && { documented: true }),
      }),
    );
  }

  protected run(request: Observable<unknown>): void {
    request.subscribe({
      next: () => {
        this.message.success('Đã cập nhật');
        this.requestName = '';
        this.reason = '';
        this.newDue = null;
        this.dueReason = '';
        this.documented = false;
        this.changed.emit();
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }
}
