import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { errorMessage } from '../../../core/api/api';
import { TaskComment, TasksApi } from '../data-access/tasks.api';

/** Bình luận trên việc (05-E, H11): chỉ thêm, không sửa/xoá, không @nhắc tên. */
@Component({
  selector: 'app-task-comments',
  imports: [DatePipe, FormsModule, NzButtonModule, NzInputModule],
  template: `
    <div class="add">
      <textarea
        nz-input
        rows="2"
        placeholder="Viết bình luận…"
        [(ngModel)]="draft"
        maxlength="2000"
      ></textarea>
      <button
        nz-button
        nzType="primary"
        nzSize="small"
        [disabled]="!draft.trim() || sending"
        (click)="send()"
      >
        Gửi
      </button>
    </div>
    @for (c of comments(); track c.id) {
      <div class="comment">
        <div class="content">{{ c.content }}</div>
        <div class="muted">
          {{ c.author?.fullName ?? '—' }} · {{ c.createdAt | date: 'dd/MM/yyyy HH:mm' }}
        </div>
      </div>
    } @empty {
      <p class="muted">Chưa có bình luận.</p>
    }
  `,
  styles: `
    .add {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      margin-bottom: 8px;
    }
    .comment {
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
export class TaskCommentsComponent {
  private readonly api = inject(TasksApi);
  private readonly message = inject(NzMessageService);

  readonly taskId = input.required<string>();
  readonly comments = input<TaskComment[]>([]);
  readonly changed = output<void>();

  protected draft = '';
  protected sending = false;

  protected send(): void {
    const content = this.draft.trim();
    if (!content) return;
    this.sending = true;
    this.api.comment(this.taskId(), content).subscribe({
      next: () => {
        this.sending = false;
        this.draft = '';
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.sending = false;
        this.message.error(errorMessage(err));
      },
    });
  }
}
