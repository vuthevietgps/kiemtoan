import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { API_URL, errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { TaskDetail, TaskHistoryItem, TasksApi, UserOption } from '../data-access/tasks.api';
import { TaskCommentsComponent } from './task-comments.component';
import { TaskDocumentsComponent } from './task-documents.component';
import { TaskFollowUpComponent } from './task-follow-up.component';
import {
  EVIDENCE_REQUIRED_MESSAGE,
  HISTORY_ACTION_LABELS,
  NOT_READY_LABEL,
  QuickAction,
  quickAction,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TaskAction,
} from '../task-labels';
import { UrgencyTagComponent } from './urgency-tag.component';

const WORKFLOW_ACTIONS = ['START', 'SUBMIT', 'COMPLETE', 'ACCEPT', 'RETURN', 'DELIVER'];

/**
 * Drawer chi tiết công việc (đặc tả 05-B): thao tác theo vai — người làm bắt đầu/gửi kiểm tra/
 * hoàn thành/giao nộp; người kiểm tra/phê duyệt cấp hiện tại chấp nhận hoặc trả lại có nội dung.
 * Giao diện đầy đủ (hàng đợi, kanban 8 cột) làm ở 05-E.
 */
@Component({
  selector: 'app-task-drawer',
  imports: [
    UrgencyTagComponent,
    DatePipe,
    DecimalPipe,
    FormsModule,
    NzDrawerModule,
    NzDescriptionsModule,
    NzButtonModule,
    NzIconModule,
    NzUploadModule,
    NzInputModule,
    NzTagModule,
    NzTimelineModule,
    NzDividerModule,
    NzAlertModule,
    NzSpinModule,
    NzSelectModule,
    TaskDocumentsComponent,
    TaskFollowUpComponent,
    TaskCommentsComponent,
  ],
  templateUrl: './task-drawer.component.html',
  styleUrl: './task-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDrawerComponent {
  private readonly api = inject(TasksApi);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);

  /** Id việc đang mở; null = đóng drawer. */
  readonly taskId = input<string | null>(null);
  readonly users = input<UserOption[]>([]);
  readonly closed = output<void>();
  /** Việc đã thay đổi → trang tải lại danh sách. */
  readonly changed = output<void>();

  protected readonly task = signal<TaskDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  /** Thao tác đang chờ vì thiếu bằng chứng → mở ô upload, tải xong làm tiếp. */
  protected readonly pending = signal<TaskAction | null>(null);
  protected evidenceNote = '';
  /** Nội dung trả lại hoặc kết quả hoàn thành/giao nộp. */
  protected note = '';

  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly statusColors = TASK_STATUS_COLORS;
  protected readonly notReady = NOT_READY_LABEL;
  protected readonly drawerWidth =
    typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 560;
  protected readonly isManager = computed(() => this.auth.permissions().has('tasks:approve'));
  protected readonly canUpdate = computed(() => this.auth.permissions().has('tasks:update'));
  private readonly me = computed(() => this.auth.user()?.id ?? null);
  protected readonly isAssignee = computed(() => this.task()?.assignee?.id === this.me());
  /** Nhật ký ngoài các bước đã có ở lịch sử trạng thái/soát xét (sửa thông tin, tải file…). */
  protected readonly otherHistory = computed(() =>
    (this.task()?.history ?? []).filter((h) => !WORKFLOW_ACTIONS.includes(h.action)),
  );

  /** Thao tác của người làm; hoàn thành cần giao nộp và giao nộp có ô kết quả. */
  protected readonly myAction = computed<QuickAction | null>(() => {
    const t = this.task();
    if (!t || !this.isAssignee()) return null;
    if (t.status === 'APPROVED') return { action: 'deliver', label: 'Xác nhận giao nộp' };
    if (t.status === 'IN_PROGRESS' && t.reviewLevels === 0)
      return { action: 'complete', label: 'Hoàn thành' };
    return quickAction(t);
  });
  protected readonly needsNote = computed(() => {
    const a = this.myAction()?.action;
    return a === 'deliver' || (a === 'complete' && !!this.task()?.requiresDelivery);
  });
  /** Người được chỉ định ở cấp hiện tại, hoặc người quản lý việc nhận thay; không phải người làm (R3). */
  protected readonly canReview = computed(() => {
    const t = this.task();
    if (!t || t.status !== 'IN_REVIEW' || this.isAssignee()) return false;
    const holder = t.reviewLevel === 1 ? t.reviewerId : t.approverId;
    return holder === this.me() || this.isManager();
  });

  constructor() {
    effect(() => {
      const id = this.taskId();
      this.pending.set(null);
      this.evidenceNote = '';
      this.note = '';
      if (id) this.load(id);
      else this.task.set(null);
    });
  }

  protected load(id: string): void {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (task) => {
        this.task.set(task);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.message.error(errorMessage(err));
        this.closed.emit();
      },
    });
  }

  protected act(action: TaskAction): void {
    const task = this.task();
    if (!task) return;
    const needsEvidence = action === 'submit' || action === 'complete';
    if (needsEvidence && task.requiresEvidence && task.documents.length === 0) {
      this.pending.set(action);
      this.message.warning(EVIDENCE_REQUIRED_MESSAGE);
      return;
    }
    this.run(task.id, this.api.act(task.id, action, this.note.trim() || undefined));
  }

  protected review(decision: 'ACCEPT' | 'RETURN'): void {
    const task = this.task();
    if (!task) return;
    this.run(task.id, this.api.review(task.id, decision, this.note.trim() || undefined));
  }

  private run(id: string, request: ReturnType<TasksApi['act']>): void {
    this.saving.set(true);
    request.subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.pending.set(null);
        this.note = '';
        this.message.success(`Đã chuyển sang "${TASK_STATUS_LABELS[updated.status]}"`);
        this.afterChange(id);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.message.error(errorMessage(err));
        this.load(id);
      },
    });
  }

  /** nz-upload: tự gửi file qua TasksApi (có token), không để nz-upload tự upload. */
  protected readonly beforeUpload = (file: NzUploadFile): boolean => {
    const task = this.task();
    if (task) this.upload(task, file as unknown as File);
    return false;
  };

  private upload(task: TaskDetail, file: File): void {
    this.uploading.set(true);
    this.api.uploadEvidence(task.id, file, this.evidenceNote.trim() || undefined).subscribe({
      next: () => {
        this.uploading.set(false);
        this.evidenceNote = '';
        this.message.success('Đã tải lên bằng chứng');
        // Đang chờ gửi kiểm tra/hoàn thành vì thiếu bằng chứng → làm tiếp.
        const pending = this.pending();
        if (pending)
          this.run(task.id, this.api.act(task.id, pending, this.note.trim() || undefined));
        else this.afterChange(task.id);
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }

  protected reassign(key: 'assigneeId' | 'reviewerId' | 'approverId', userId: string | null): void {
    const task = this.task();
    const current = key === 'assigneeId' ? (task?.assignee?.id ?? null) : task?.[key];
    if (!task || userId === current) return;
    this.api.update(task.id, { [key]: userId }).subscribe({
      next: () => {
        this.message.success('Đã cập nhật người phụ trách');
        this.afterChange(task.id);
      },
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }

  protected downloadUrl(documentId: string): string {
    return `${API_URL}/documents/${documentId}/download?token=${encodeURIComponent(this.auth.token() ?? '')}`;
  }

  protected historyText(item: TaskHistoryItem): string {
    const label = HISTORY_ACTION_LABELS[item.action] ?? item.action;
    const d = item.detail;
    if (item.action === 'EVIDENCE' && d?.fileName) return `${label}: ${d.fileName}`;
    return label;
  }

  /** Thành phần con (hồ sơ, theo dõi) đã đổi dữ liệu việc. */
  protected refresh(): void {
    const task = this.task();
    if (task) this.afterChange(task.id);
  }

  private afterChange(id: string): void {
    this.load(id);
    this.changed.emit();
  }
}
