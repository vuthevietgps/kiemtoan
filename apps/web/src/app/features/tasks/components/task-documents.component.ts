import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  DocumentRequestQuery,
  DocumentRequestRow,
  DocumentRequestsApi,
} from '../data-access/document-requests.api';
import { DOCUMENT_REQUEST_LABELS } from '../task-labels';

/**
 * Hồ sơ cần thu của khách cho bước và kỳ của việc (05-D, PL1 V): 6 trạng thái, nhân viên ghi nhận đã
 * yêu cầu và tải thay khách (QD00). Màn hình hồ sơ theo KH/HĐ đầy đủ làm ở 05-E.
 */
@Component({
  selector: 'app-task-documents',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzTagModule, NzUploadModule],
  template: `
    @for (r of rows(); track r.id) {
      <div class="row">
        <div class="head">
          @if (showCustomer()) {
            <span>{{ r.customerName }} ·</span>
          }
          <b>{{ r.name }}</b>
          @if (!r.required) {
            <span class="muted">(tuỳ chọn)</span>
          }
          <span class="muted">· {{ r.perPeriod ? 'kỳ ' + r.period : 'một lần' }}</span>
          <nz-tag [nzColor]="labels[r.status].color">{{ labels[r.status].label }}</nz-tag>
          @if (r.fileCount) {
            <span class="muted">{{ r.fileCount }} file</span>
          }
        </div>
        @if (r.status === 'NEEDS_SUPPLEMENT' && r.supplementNote) {
          <div class="muted">Cần bổ sung: {{ r.supplementNote }}</div>
        }
        @if (canAct() && r.status !== 'ACCEPTED') {
          <div class="actions">
            @if (r.status === 'NOT_REQUESTED' || r.status === 'NEEDS_SUPPLEMENT') {
              <button nz-button nzSize="small" (click)="run(api.markRequested(r.id))">
                Đã yêu cầu khách
              </button>
            }
            <nz-upload [nzBeforeUpload]="uploader(r)" [nzShowUploadList]="false">
              <button nz-button nzSize="small">Tải thay khách</button>
            </nz-upload>
            @if (r.status === 'UPLOADED') {
              <button nz-button nzSize="small" (click)="run(api.review(r.id))">Kiểm tra</button>
            }
            @if (r.status === 'UPLOADED' || r.status === 'IN_REVIEW') {
              <button nz-button nzSize="small" nzType="primary" (click)="run(api.accept(r.id))">
                Chấp nhận
              </button>
              <input
                nz-input
                nzSize="small"
                placeholder="Nội dung cần bổ sung"
                [(ngModel)]="notes[r.id]"
              />
              <button
                nz-button
                nzSize="small"
                nzDanger
                [disabled]="(notes[r.id] ?? '').trim().length < 5"
                (click)="run(api.supplement(r.id, notes[r.id].trim()))"
              >
                Cần bổ sung
              </button>
            }
          </div>
        }
      </div>
    } @empty {
      <p class="muted">Không có hồ sơ cần thu của khách.</p>
    }
  `,
  styles: `
    .row {
      padding: 6px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .actions input {
      width: 180px;
    }
    .muted {
      color: rgba(0, 0, 0, 0.55);
      font-size: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDocumentsComponent {
  protected readonly api = inject(DocumentRequestsApi);
  private readonly message = inject(NzMessageService);

  /** Hồ sơ của bước và kỳ một việc ({ taskId }) hoặc theo khách/trạng thái/kỳ (màn hình hồ sơ). */
  readonly query = input.required<DocumentRequestQuery>();
  /** Hiện tên khách hàng (màn hình hồ sơ nhiều khách). */
  readonly showCustomer = input(false);
  /** Người có quyền cập nhật việc (`tasks:update`). */
  readonly canAct = input(false);
  /** Trạng thái việc có thể đổi (cần bổ sung → Chờ khách, chấp nhận → mở lại). */
  readonly changed = output<void>();

  protected readonly rows = signal<DocumentRequestRow[]>([]);
  protected readonly labels = DOCUMENT_REQUEST_LABELS;
  protected notes: Record<string, string> = {};

  constructor() {
    effect(() => {
      const query = this.query();
      untracked(() => this.load(query));
    });
  }

  protected uploader(row: DocumentRequestRow) {
    return (file: NzUploadFile): boolean => {
      this.run(this.api.upload(row.id, file as unknown as File));
      return false;
    };
  }

  protected run(request: Observable<unknown>): void {
    request.subscribe({
      next: () => {
        this.message.success('Đã cập nhật hồ sơ');
        this.notes = {};
        this.load(this.query());
        this.changed.emit();
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }

  private load(query: DocumentRequestQuery): void {
    this.api.list(query).subscribe({
      next: (rows) => this.rows.set(rows),
      error: () => this.rows.set([]),
    });
  }
}
