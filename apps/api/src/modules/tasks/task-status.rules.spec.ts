import { TaskStatus } from '@prisma/client';
import {
  applyAction,
  EVIDENCE_REQUIRED_MESSAGE,
  isWorkflowError,
  reviewSetupError,
  statusGroup,
  WorkflowActor,
  WorkflowResult,
  WorkflowTask,
} from './task-status.rules';

const NOW = new Date('2026-10-22T03:00:00Z');
const EARLIER = new Date('2026-10-20T03:00:00Z');

const task = (extra: Partial<WorkflowTask> = {}): WorkflowTask => ({
  status: TaskStatus.NOT_STARTED,
  reviewLevels: 0,
  reviewLevel: null,
  assigneeId: 'staff',
  reviewerId: null,
  approverId: null,
  approvedById: null,
  requiresEvidence: true,
  requiresDelivery: false,
  startedAt: null,
  firstSubmittedAt: null,
  acceptedAt: null,
  ...extra,
});
const staff: WorkflowActor = { id: 'staff', canManage: false };
const lead: WorkflowActor = { id: 'lead', canManage: false };
const boss: WorkflowActor = { id: 'boss', canManage: false };
const manager: WorkflowActor = { id: 'manager', canManage: true };
const ctx = { evidenceCount: 1, now: NOW };

const ok = (r: ReturnType<typeof applyAction>): WorkflowResult => {
  if (isWorkflowError(r)) throw new Error(r.message);
  return r;
};

/** Việc 2 cấp đang chờ kiểm tra ở cấp `level`. */
const inReview = (level: number, extra: Partial<WorkflowTask> = {}) =>
  task({
    status: TaskStatus.IN_REVIEW,
    reviewLevels: 2,
    reviewLevel: level,
    reviewerId: 'lead',
    approverId: 'boss',
    firstSubmittedAt: EARLIER,
    ...extra,
  });

describe('task-status.rules — bắt đầu, hoàn thành (0 cấp)', () => {
  it('người làm bắt đầu việc Chưa bắt đầu, ghi startedAt lần đầu', () => {
    const r = ok(applyAction('START', task(), staff, ctx));
    expect(r.to).toBe(TaskStatus.IN_PROGRESS);
    expect(r.data.startedAt).toEqual(NOW);
  });

  it('H6: bước trước cùng kỳ chưa xong thì chưa bắt đầu được, báo rõ bước còn thiếu', () => {
    const r = applyAction('START', task(), staff, {
      ...ctx,
      waitingFor: ['Thu thập chứng từ', 'Đối chiếu'],
    });
    expect(r).toEqual({
      kind: 'invalid',
      message:
        'Chưa đủ điều kiện: bước trước chưa xong — Thu thập chứng từ, Đối chiếu',
    });
  });

  it('H4: còn hồ sơ bắt buộc chưa chấp nhận thì chưa bắt đầu được', () => {
    const r = applyAction('START', task(), staff, {
      ...ctx,
      missingDocuments: ['Sao kê ngân hàng'],
    });
    expect(r).toEqual({
      kind: 'invalid',
      message: 'Còn hồ sơ bắt buộc chưa chấp nhận: Sao kê ngân hàng',
    });
  });

  it('người khác (kể cả quản lý) không bắt đầu thay người làm', () => {
    expect(applyAction('START', task(), manager, ctx)).toMatchObject({
      kind: 'forbidden',
    });
  });

  it('không bắt đầu lại việc đang làm', () => {
    const r = applyAction(
      'START',
      task({ status: TaskStatus.IN_PROGRESS }),
      staff,
      ctx,
    );
    expect(r).toMatchObject({ kind: 'invalid' });
  });

  it('việc 0 cấp: thiếu bằng chứng bắt buộc thì không hoàn thành', () => {
    const r = applyAction(
      'COMPLETE',
      task({ status: TaskStatus.IN_PROGRESS }),
      staff,
      { evidenceCount: 0, now: NOW },
    );
    expect(r).toEqual({ kind: 'invalid', message: EVIDENCE_REQUIRED_MESSAGE });
  });

  it('việc 0 cấp: hoàn thành ghi mốc nộp/chấp nhận/hoàn thành và 100%', () => {
    const r = ok(
      applyAction(
        'COMPLETE',
        task({ status: TaskStatus.IN_PROGRESS }),
        staff,
        ctx,
      ),
    );
    expect(r.to).toBe(TaskStatus.COMPLETED);
    expect(r.data).toMatchObject({
      completedAt: NOW,
      firstSubmittedAt: NOW,
      acceptedAt: NOW,
      progress: 100,
    });
  });

  it('việc cần soát xét không tự hoàn thành được (PL1)', () => {
    const r = applyAction(
      'COMPLETE',
      task({ status: TaskStatus.IN_PROGRESS, reviewLevels: 1 }),
      staff,
      ctx,
    );
    expect(r).toMatchObject({ kind: 'invalid' });
  });
});

describe('task-status.rules — gửi kiểm tra', () => {
  const working = (extra: Partial<WorkflowTask> = {}) =>
    task({
      status: TaskStatus.IN_PROGRESS,
      reviewLevels: 1,
      reviewerId: 'lead',
      ...extra,
    });

  it('gửi kiểm tra → Chờ kiểm tra cấp 1, ghi mốc nộp đầu', () => {
    const r = ok(applyAction('SUBMIT', working(), staff, ctx));
    expect(r.to).toBe(TaskStatus.IN_REVIEW);
    expect(r.data).toMatchObject({ reviewLevel: 1, firstSubmittedAt: NOW });
  });

  it('gửi lại sau khi bị trả: giữ mốc nộp đầu (G4)', () => {
    const r = ok(
      applyAction(
        'SUBMIT',
        working({
          status: TaskStatus.CHANGES_REQUESTED,
          firstSubmittedAt: EARLIER,
        }),
        staff,
        ctx,
      ),
    );
    expect(r.data).not.toHaveProperty('firstSubmittedAt');
  });

  it('thiếu bằng chứng, chưa có người kiểm tra hoặc việc 0 cấp → lỗi 400', () => {
    expect(
      applyAction('SUBMIT', working(), staff, { evidenceCount: 0 }),
    ).toEqual({ kind: 'invalid', message: EVIDENCE_REQUIRED_MESSAGE });
    expect(
      applyAction('SUBMIT', working({ reviewerId: null }), staff, ctx),
    ).toEqual({ kind: 'invalid', message: 'Việc chưa có người kiểm tra' });
    expect(
      applyAction('SUBMIT', working({ reviewLevels: 0 }), staff, ctx),
    ).toMatchObject({ kind: 'invalid' });
  });

  it('chỉ người làm gửi kiểm tra', () => {
    expect(applyAction('SUBMIT', working(), lead, ctx)).toMatchObject({
      kind: 'forbidden',
    });
  });

  it('H3: người kiểm tra/phê duyệt trùng người làm hoặc trùng nhau thì chặn gửi', () => {
    expect(reviewSetupError(working({ reviewerId: 'staff' }))).toBe(
      'Người kiểm tra phải khác người thực hiện',
    );
    const two = { reviewLevels: 2, reviewerId: 'lead' };
    expect(reviewSetupError(working({ ...two, approverId: null }))).toBe(
      'Việc chưa có người phê duyệt',
    );
    expect(reviewSetupError(working({ ...two, approverId: 'staff' }))).toBe(
      'Người phê duyệt phải khác người thực hiện',
    );
    expect(reviewSetupError(working({ ...two, approverId: 'lead' }))).toBe(
      'Một người không vừa kiểm tra vừa phê duyệt cùng một việc',
    );
    expect(
      reviewSetupError(working({ ...two, approverId: 'boss' })),
    ).toBeNull();
    expect(reviewSetupError(task({ reviewerId: 'staff' }))).toBeNull();
  });
});

describe('task-status.rules — soát xét nhiều cấp', () => {
  it('cấp 1 chấp nhận việc 2 cấp → lên cấp 2, chưa có mốc chấp nhận', () => {
    const r = ok(applyAction('ACCEPT', inReview(1), lead, ctx));
    expect(r).toEqual({ to: TaskStatus.IN_REVIEW, data: { reviewLevel: 2 } });
  });

  it('cấp cuối chấp nhận, bước không cần giao nộp → Hoàn thành (H1)', () => {
    const r = ok(applyAction('ACCEPT', inReview(2), boss, ctx));
    expect(r.to).toBe(TaskStatus.COMPLETED);
    expect(r.data).toMatchObject({
      reviewLevel: null,
      approvedById: 'boss',
      acceptedAt: NOW,
      completedAt: NOW,
      progress: 100,
    });
  });

  it('cấp cuối chấp nhận, bước cần giao nộp → Đã phê duyệt (H1)', () => {
    const r = ok(
      applyAction('ACCEPT', inReview(2, { requiresDelivery: true }), boss, ctx),
    );
    expect(r.to).toBe(TaskStatus.APPROVED);
    expect(r.data).not.toHaveProperty('completedAt');
  });

  it('R3: người làm không kiểm tra/phê duyệt việc của mình, kể cả người quản lý việc', () => {
    const own = inReview(1, { assigneeId: 'manager' });
    expect(applyAction('ACCEPT', own, manager, ctx)).toMatchObject({
      kind: 'forbidden',
    });
  });

  it('chỉ người được chỉ định ở cấp hiện tại xử lý; người quản lý việc nhận thay được', () => {
    expect(applyAction('ACCEPT', inReview(1), boss, ctx)).toMatchObject({
      kind: 'forbidden',
    });
    expect(applyAction('ACCEPT', inReview(2), lead, ctx)).toMatchObject({
      kind: 'forbidden',
    });
    expect(
      isWorkflowError(applyAction('ACCEPT', inReview(1), manager, ctx)),
    ).toBe(false);
  });

  it('H3: người đã chấp nhận cấp 1 không xử lý tiếp cấp 2', () => {
    const r = applyAction(
      'ACCEPT',
      inReview(2),
      { ...manager, acceptedEarlierLevel: true },
      ctx,
    );
    expect(r).toMatchObject({ kind: 'forbidden' });
  });

  it('trả lại bắt buộc nội dung 5–2000 ký tự, đếm số lần trả lại', () => {
    expect(
      applyAction('RETURN', inReview(1), lead, { ...ctx, note: 'sai' }),
    ).toMatchObject({ kind: 'invalid' });
    expect(
      applyAction('RETURN', inReview(1), lead, {
        ...ctx,
        note: 'x'.repeat(2001),
      }),
    ).toMatchObject({ kind: 'invalid' });
    const r = ok(
      applyAction('RETURN', inReview(2), boss, {
        ...ctx,
        note: 'Thiếu bảng đối chiếu',
      }),
    );
    expect(r).toEqual({
      to: TaskStatus.CHANGES_REQUESTED,
      data: {
        status: TaskStatus.CHANGES_REQUESTED,
        reviewLevel: null,
        returnCount: { increment: 1 },
      },
    });
  });

  it('không soát xét việc không ở Chờ kiểm tra', () => {
    const r = applyAction(
      'ACCEPT',
      task({ status: TaskStatus.IN_PROGRESS, reviewerId: 'lead' }),
      lead,
      ctx,
    );
    expect(r).toMatchObject({ kind: 'invalid' });
  });

  it('chấp nhận lại sau khi mở lại: giữ mốc chấp nhận cũ (G4)', () => {
    const r = ok(
      applyAction('ACCEPT', inReview(2, { acceptedAt: EARLIER }), boss, ctx),
    );
    expect(r.data).not.toHaveProperty('acceptedAt');
  });
});

describe('task-status.rules — giao nộp', () => {
  const approved = task({
    status: TaskStatus.APPROVED,
    reviewLevels: 1,
    reviewerId: 'lead',
    approvedById: 'lead',
    requiresDelivery: true,
  });

  it('người làm xác nhận giao nộp kèm kết quả → Hoàn thành', () => {
    const r = ok(
      applyAction('DELIVER', approved, staff, {
        evidenceCount: 0,
        note: 'Đã nộp tờ khai, mã giao dịch 123',
        now: NOW,
      }),
    );
    expect(r.to).toBe(TaskStatus.COMPLETED);
    expect(r.data).toMatchObject({
      completedAt: NOW,
      resultNote: 'Đã nộp tờ khai, mã giao dịch 123',
    });
  });

  it('thiếu kết quả (ghi chú hoặc file sau phê duyệt) → lỗi', () => {
    expect(
      applyAction('DELIVER', approved, staff, { evidenceCount: 0 }),
    ).toMatchObject({ kind: 'invalid' });
  });

  it('người phê duyệt cũng xác nhận được; người ngoài thì không', () => {
    expect(isWorkflowError(applyAction('DELIVER', approved, lead, ctx))).toBe(
      false,
    );
    expect(applyAction('DELIVER', approved, boss, ctx)).toMatchObject({
      kind: 'forbidden',
    });
  });
});

describe('statusGroup', () => {
  it('chia 8 trạng thái vào 3 nhóm hiển thị cũ', () => {
    expect(statusGroup(TaskStatus.WAITING_CLIENT)).toBe('TODO');
    expect(statusGroup(TaskStatus.IN_REVIEW)).toBe('IN_PROGRESS');
    expect(statusGroup(TaskStatus.APPROVED)).toBe('IN_PROGRESS');
    expect(statusGroup(TaskStatus.COMPLETED)).toBe('DONE');
  });
});
