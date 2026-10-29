import { Prisma, TaskStatus } from '@prisma/client';

/**
 * Máy trạng thái công việc (đặc tả 05, 8 trạng thái PL1 III.3, H1–H3; G4). Hàm thuần: nhận việc,
 * người thao tác và ngữ cảnh, trả lỗi hoặc trạng thái đích + dữ liệu cần ghi. Tạm dừng, chờ khách,
 * mở lại và gia hạn thuộc 05-D.
 */

export const EVIDENCE_REQUIRED_MESSAGE =
  'Vui lòng tải lên file bằng chứng trước khi gửi kiểm tra hoặc hoàn thành';
export const NOTE_MIN = 5;
export const NOTE_MAX = 2000;

/** Chưa Hoàn thành = còn phải làm (kể cả Đã phê duyệt chờ giao nộp, Tạm dừng). */
export const OPEN_STATUSES: TaskStatus[] = Object.values(TaskStatus).filter(
  (s) => s !== TaskStatus.COMPLETED,
);

/**
 * Ba nhóm hiển thị giữ cho dashboard/thống kê cũ cho tới khi 05-E làm lại giao diện:
 * Chưa làm (chưa bắt đầu, chờ khách, tạm dừng) / Đang làm (đang làm, đang soát xét, chờ giao nộp) /
 * Xong (Hoàn thành).
 */
export const STATUS_GROUPS = {
  TODO: [TaskStatus.NOT_STARTED, TaskStatus.WAITING_CLIENT, TaskStatus.ON_HOLD],
  IN_PROGRESS: [
    TaskStatus.IN_PROGRESS,
    TaskStatus.IN_REVIEW,
    TaskStatus.CHANGES_REQUESTED,
    TaskStatus.APPROVED,
  ],
  DONE: [TaskStatus.COMPLETED],
} as const satisfies Record<string, readonly TaskStatus[]>;
export type StatusGroup = keyof typeof STATUS_GROUPS;

export function statusGroup(status: TaskStatus): StatusGroup {
  return (Object.keys(STATUS_GROUPS) as StatusGroup[]).find((g) =>
    (STATUS_GROUPS[g] as readonly TaskStatus[]).includes(status),
  )!;
}

export type WorkflowAction =
  'START' | 'SUBMIT' | 'COMPLETE' | 'ACCEPT' | 'RETURN' | 'DELIVER';

export interface WorkflowTask {
  status: TaskStatus;
  reviewLevels: number;
  reviewLevel: number | null;
  assigneeId: string | null;
  reviewerId: string | null;
  approverId: string | null;
  approvedById: string | null;
  requiresEvidence: boolean;
  requiresDelivery: boolean;
  startedAt: Date | null;
  firstSubmittedAt: Date | null;
  acceptedAt: Date | null;
}

export interface WorkflowActor {
  id: string;
  /** Người quản lý việc: `tasks:approve` hiệu lực trong phạm vi hoặc Manager dòng dịch vụ. */
  canManage: boolean;
  /** Đã chấp nhận cấp trước của lượt soát xét này (một người không giữ hai cấp — H3). */
  acceptedEarlierLevel?: boolean;
}

export interface WorkflowContext {
  evidenceCount: number;
  /** Nội dung trả lại hoặc kết quả giao nộp/hoàn thành. */
  note?: string | null;
  /** Tên các bước trước (cùng kỳ) chưa Đã phê duyệt/Hoàn thành — H6. */
  waitingFor?: string[];
  /** H4: hồ sơ bắt buộc của bước (cùng kỳ) chưa "Đã chấp nhận". */
  missingDocuments?: string[];
  now?: Date;
}

export type WorkflowError =
  { kind: 'forbidden'; message: string } | { kind: 'invalid'; message: string };

export interface WorkflowResult {
  to: TaskStatus;
  data: Prisma.TaskUncheckedUpdateManyInput;
}

const forbidden = (message: string): WorkflowError => ({
  kind: 'forbidden',
  message,
});
const invalid = (message: string): WorkflowError => ({
  kind: 'invalid',
  message,
});

export const isWorkflowError = (
  r: WorkflowError | WorkflowResult,
): r is WorkflowError => 'kind' in r;

/** Người được chỉ định ở một cấp: 1 = người kiểm tra, 2 = người phê duyệt. */
export function levelHolder(task: WorkflowTask, level: number): string | null {
  return level === 1 ? task.reviewerId : task.approverId;
}

/** H3: người kiểm tra/phê duyệt hợp lệ trước khi gửi kiểm tra. Việc 0 cấp không bị ràng buộc. */
export function reviewSetupError(task: WorkflowTask): string | null {
  if (task.reviewLevels < 1) return null;
  if (!task.reviewerId) return 'Việc chưa có người kiểm tra';
  if (task.reviewerId === task.assigneeId)
    return 'Người kiểm tra phải khác người thực hiện';
  if (task.reviewLevels < 2) return null;
  if (!task.approverId) return 'Việc chưa có người phê duyệt';
  if (task.approverId === task.assigneeId)
    return 'Người phê duyệt phải khác người thực hiện';
  if (task.approverId === task.reviewerId)
    return 'Một người không vừa kiểm tra vừa phê duyệt cùng một việc';
  return null;
}

const noteLength = (note?: string | null) => note?.trim().length ?? 0;
const validNote = (note?: string | null) =>
  noteLength(note) >= NOTE_MIN && noteLength(note) <= NOTE_MAX;

function reviewerError(
  task: WorkflowTask,
  actor: WorkflowActor,
): WorkflowError | null {
  if (task.status !== TaskStatus.IN_REVIEW || !task.reviewLevel)
    return invalid('Việc không ở trạng thái Chờ kiểm tra');
  // R3: người thực hiện không kiểm tra/phê duyệt việc của mình ở bất kỳ cấp nào.
  if (actor.id === task.assigneeId)
    return forbidden(
      'Người thực hiện không được kiểm tra hoặc phê duyệt việc của chính mình',
    );
  if (actor.acceptedEarlierLevel)
    return forbidden(
      'Một người không vừa kiểm tra vừa phê duyệt cùng một việc',
    );
  if (actor.id !== levelHolder(task, task.reviewLevel) && !actor.canManage)
    return forbidden(
      task.reviewLevel === 1
        ? 'Chỉ người kiểm tra của việc được xử lý cấp này'
        : 'Chỉ người phê duyệt của việc được xử lý cấp này',
    );
  return null;
}

function assigneeError(
  task: WorkflowTask,
  actor: WorkflowActor,
): WorkflowError | null {
  return actor.id === task.assigneeId
    ? null
    : forbidden('Chỉ người thực hiện việc được thao tác này');
}

const evidenceMissing = (task: WorkflowTask, ctx: WorkflowContext) =>
  task.requiresEvidence && ctx.evidenceCount === 0;

/** Trả lỗi nếu không được thực hiện, hoặc trạng thái đích + dữ liệu ghi. */
export function applyAction(
  action: WorkflowAction,
  task: WorkflowTask,
  actor: WorkflowActor,
  ctx: WorkflowContext,
): WorkflowError | WorkflowResult {
  const now = ctx.now ?? new Date();
  const s = task.status;
  switch (action) {
    case 'START': {
      if (s !== TaskStatus.NOT_STARTED)
        return invalid('Chỉ bắt đầu được việc Chưa bắt đầu');
      const error = assigneeError(task, actor);
      if (error) return error;
      if (ctx.waitingFor?.length)
        return invalid(
          `Chưa đủ điều kiện: bước trước chưa xong — ${ctx.waitingFor.join(', ')}`,
        );
      if (ctx.missingDocuments?.length)
        return invalid(
          `Còn hồ sơ bắt buộc chưa chấp nhận: ${ctx.missingDocuments.join(', ')}`,
        );
      return {
        to: TaskStatus.IN_PROGRESS,
        data: {
          status: TaskStatus.IN_PROGRESS,
          ...(!task.startedAt && { startedAt: now }),
        },
      };
    }
    case 'SUBMIT': {
      if (s !== TaskStatus.IN_PROGRESS && s !== TaskStatus.CHANGES_REQUESTED)
        return invalid(
          'Chỉ gửi kiểm tra việc Đang thực hiện hoặc Yêu cầu chỉnh sửa',
        );
      const error = assigneeError(task, actor);
      if (error) return error;
      if (task.reviewLevels < 1)
        return invalid('Việc không cần soát xét; hãy bấm Hoàn thành');
      if (evidenceMissing(task, ctx)) return invalid(EVIDENCE_REQUIRED_MESSAGE);
      const setup = reviewSetupError(task);
      if (setup) return invalid(setup);
      return {
        to: TaskStatus.IN_REVIEW,
        data: {
          status: TaskStatus.IN_REVIEW,
          reviewLevel: 1,
          // G4: mốc nộp đầu chỉ ghi lần đầu.
          ...(!task.firstSubmittedAt && { firstSubmittedAt: now }),
        },
      };
    }
    case 'COMPLETE': {
      if (s !== TaskStatus.IN_PROGRESS)
        return invalid('Chỉ hoàn thành được việc Đang thực hiện');
      const error = assigneeError(task, actor);
      if (error) return error;
      if (task.reviewLevels > 0)
        return invalid(
          'Việc cần soát xét; hãy gửi kiểm tra thay vì tự hoàn thành',
        );
      if (evidenceMissing(task, ctx)) return invalid(EVIDENCE_REQUIRED_MESSAGE);
      if (task.requiresDelivery && !validNote(ctx.note) && !ctx.evidenceCount)
        return invalid('Vui lòng ghi kết quả giao nộp hoặc tải file kết quả');
      return {
        to: TaskStatus.COMPLETED,
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: now,
          progress: 100,
          ...(!task.firstSubmittedAt && { firstSubmittedAt: now }),
          ...(!task.acceptedAt && { acceptedAt: now }),
          ...(validNote(ctx.note) && { resultNote: ctx.note!.trim() }),
        },
      };
    }
    case 'ACCEPT': {
      const error = reviewerError(task, actor);
      if (error) return error;
      const level = task.reviewLevel!;
      if (level < task.reviewLevels)
        return {
          to: TaskStatus.IN_REVIEW,
          data: { reviewLevel: level + 1 },
        };
      // Cấp cuối: H1 — còn giao nộp thì Đã phê duyệt, không thì Hoàn thành.
      const accepted = {
        reviewLevel: null,
        approvedById: actor.id,
        approvedAt: now,
        ...(!task.acceptedAt && { acceptedAt: now }),
      };
      if (task.requiresDelivery)
        return {
          to: TaskStatus.APPROVED,
          data: { ...accepted, status: TaskStatus.APPROVED },
        };
      return {
        to: TaskStatus.COMPLETED,
        data: {
          ...accepted,
          status: TaskStatus.COMPLETED,
          completedAt: now,
          progress: 100,
        },
      };
    }
    case 'RETURN': {
      const error = reviewerError(task, actor);
      if (error) return error;
      if (!validNote(ctx.note))
        return invalid(
          `Vui lòng ghi nội dung cần chỉnh sửa (${NOTE_MIN}–${NOTE_MAX} ký tự)`,
        );
      return {
        to: TaskStatus.CHANGES_REQUESTED,
        data: {
          status: TaskStatus.CHANGES_REQUESTED,
          reviewLevel: null,
          returnCount: { increment: 1 },
        },
      };
    }
    case 'DELIVER': {
      if (s !== TaskStatus.APPROVED)
        return invalid('Chỉ xác nhận giao nộp cho việc Đã phê duyệt');
      if (
        actor.id !== task.assigneeId &&
        actor.id !== task.approvedById &&
        !actor.canManage
      )
        return forbidden(
          'Chỉ người thực hiện hoặc người phê duyệt xác nhận giao nộp',
        );
      if (!validNote(ctx.note) && !ctx.evidenceCount)
        return invalid('Vui lòng ghi kết quả giao nộp hoặc tải file kết quả');
      return {
        to: TaskStatus.COMPLETED,
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: now,
          progress: 100,
          ...(validNote(ctx.note) && { resultNote: ctx.note!.trim() }),
        },
      };
    }
  }
}
