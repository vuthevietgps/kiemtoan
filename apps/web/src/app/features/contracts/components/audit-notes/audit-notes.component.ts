import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TaskPriority,
} from '../../../tasks/task-labels';
import { AUDIT_TEXT } from '../../audit-tracking.text';
import { AuditEngagementView } from '../../data-access/audit-tracking.api';

const NOTE_MIN = 2;
const NOTE_MAX = 2000;

/**
 * Mức độ và báo cáo tình hình cụ thể của một hồ sơ kiểm toán (04-F4, bám bảng LTGroup). Nhật ký
 * chỉ thêm, mới nhất trước. Chỉ nhận input và phát output; panel cha gọi API.
 */
@Component({
  selector: 'app-audit-notes',
  imports: [DatePipe, FormsModule, NzButtonModule, NzInputModule, NzSelectModule, NzTagModule],
  template: `
    @let item_ = item();
    @let e_ = item_.engagement;
    <div class="notes">
      <div class="priority">
        <span class="muted">{{ text.priority }}:</span>
        @if (item_.canPrioritize) {
          <nz-select
            [ngModel]="e_.priority"
            [nzDisabled]="busy()"
            (ngModelChange)="setPriority.emit($event)"
          >
            @for (p of priorities; track p) {
              <nz-option [nzValue]="p" [nzLabel]="priorityLabels[p]" />
            }
          </nz-select>
        } @else {
          <nz-tag [nzColor]="priorityColors[e_.priority]">{{ priorityLabels[e_.priority] }}</nz-tag>
        }
      </div>

      <h4>{{ text.notesTitle }}</h4>
      @if (item_.canNote) {
        <div class="add">
          <textarea
            nz-input
            rows="2"
            [placeholder]="text.notePlaceholder"
            [(ngModel)]="draft"
            [maxlength]="max"
          ></textarea>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="busy() || draft.trim().length < min"
            (click)="submit()"
          >
            {{ text.addNote }}
          </button>
        </div>
      }
      <ul class="list">
        @for (n of e_.notes; track n.id) {
          <li>
            <div class="content">{{ n.content }}</div>
            <div class="muted">
              {{ n.author?.fullName ?? '—' }} · {{ n.createdAt | date: 'dd/MM/yyyy HH:mm' }}
            </div>
          </li>
        } @empty {
          <li class="muted">{{ text.noNotes }}</li>
        }
      </ul>
    </div>
  `,
  styles: `
    .notes {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed #e5e7eb;
    }
    .priority {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .priority nz-select {
      width: 160px;
    }
    h4 {
      margin: 12px 0 6px;
    }
    .add {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      margin-bottom: 8px;
    }
    .list {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 320px;
      overflow-y: auto;
    }
    .list li {
      padding: 6px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .content {
      white-space: pre-wrap;
      word-break: break-word;
    }
    .muted {
      color: rgba(0, 0, 0, 0.55);
      font-size: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditNotesComponent {
  readonly item = input.required<AuditEngagementView>();
  readonly busy = input(false);
  readonly setPriority = output<TaskPriority>();
  /** `saved` được gọi khi lưu thành công để xoá ô nhập (lỗi thì giữ nội dung). */
  readonly addNote = output<{ content: string; saved: () => void }>();

  protected readonly text = AUDIT_TEXT;
  protected readonly priorities = TASK_PRIORITIES;
  protected readonly priorityLabels = TASK_PRIORITY_LABELS;
  protected readonly priorityColors = TASK_PRIORITY_COLORS;
  protected readonly min = NOTE_MIN;
  protected readonly max = NOTE_MAX;
  protected draft = '';

  protected submit(): void {
    const content = this.draft.trim();
    if (content.length < NOTE_MIN) return;
    this.addNote.emit({ content, saved: () => (this.draft = '') });
  }
}
