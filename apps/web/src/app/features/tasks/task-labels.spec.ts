import { quickAction, TaskStatus } from './task-labels';

const task = (status: TaskStatus, extra: Partial<Parameters<typeof quickAction>[0]> = {}) => ({
  status,
  reviewLevels: 0,
  requiresDelivery: false,
  waitingFor: [],
  ...extra,
});

describe('quickAction — nút nhanh / kéo thả kanban (05-E)', () => {
  it('Chưa bắt đầu → Bắt đầu; còn bước trước chưa xong (H6) thì không', () => {
    expect(quickAction(task('NOT_STARTED'))?.action).toBe('start');
    expect(quickAction(task('NOT_STARTED', { waitingFor: ['Thu thập chứng từ'] }))).toBeNull();
  });

  it('Đang thực hiện: có soát xét → Gửi kiểm tra; 0 cấp → Hoàn thành; cần giao nộp thì mở chi tiết', () => {
    expect(quickAction(task('IN_PROGRESS', { reviewLevels: 1 }))?.action).toBe('submit');
    expect(quickAction(task('IN_PROGRESS'))?.action).toBe('complete');
    expect(quickAction(task('IN_PROGRESS', { requiresDelivery: true }))).toBeNull();
  });

  it('Yêu cầu chỉnh sửa → Gửi lại; các trạng thái khác làm trong chi tiết việc', () => {
    expect(quickAction(task('CHANGES_REQUESTED', { reviewLevels: 1 }))?.label).toBe('Gửi lại');
    for (const s of ['WAITING_CLIENT', 'IN_REVIEW', 'APPROVED', 'COMPLETED', 'ON_HOLD'] as const)
      expect(quickAction(task(s))).toBeNull();
  });
});
