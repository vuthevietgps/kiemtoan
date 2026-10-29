import { TaskStatus } from '@prisma/client';
import {
  effectivePrerequisites,
  PlanStepNode,
  TaskStatusIndex,
  unmetPrerequisites,
} from './task-dependencies';
import { periodProgress } from './task-progress';

const step = (
  key: string,
  dependsOn: string[] = [],
  extra: Partial<PlanStepNode> = {},
): PlanStepNode => ({
  id: `s-${key}`,
  planId: 'plan',
  stepKey: key,
  name: `Bước ${key}`,
  skipped: false,
  required: true,
  durationDays: null,
  dueOffsetDays: null,
  dependsOn,
  ...extra,
});

describe('H6 — điều kiện phụ thuộc giữa bước', () => {
  // B01 → B02 (bỏ qua) → B03; B03 cũng chờ B04.
  const steps = [
    step('B01'),
    step('B02', ['B01'], { skipped: true, required: false }),
    step('B03', ['B02', 'B04']),
    step('B04'),
  ];
  const prerequisites = effectivePrerequisites(steps);
  const status = (entries: [string, string, TaskStatus][]): TaskStatusIndex =>
    new Map(entries.map(([id, period, s]) => [`${id}|${period}`, s]));
  const task = (period: string) => ({
    id: `t-${period}`,
    planStepId: 's-B03',
    period,
  });

  it('bước bị bỏ qua được nối thẳng tới bước nó chờ', () => {
    expect(prerequisites.get('s-B03')!.map((s) => s.stepKey)).toEqual([
      'B01',
      'B04',
    ]);
    expect(prerequisites.get('s-B01')).toEqual([]);
  });

  it('chỉ xét việc cùng kỳ; thoả khi Đã phê duyệt hoặc Hoàn thành', () => {
    const statuses = status([
      ['s-B01', '2026-01', TaskStatus.APPROVED],
      ['s-B04', '2026-01', TaskStatus.COMPLETED],
      ['s-B01', '2026-02', TaskStatus.COMPLETED],
      ['s-B04', '2026-02', TaskStatus.IN_REVIEW],
    ]);
    const unmet = unmetPrerequisites(
      [task('2026-01'), task('2026-02')],
      prerequisites,
      statuses,
    );
    expect(unmet.has('t-2026-01')).toBe(false);
    expect(unmet.get('t-2026-02')).toEqual(['Bước B04']);
  });

  it('bước trước chưa có việc (dữ liệu cũ) không chặn; việc không có bước kế hoạch không xét', () => {
    const unmet = unmetPrerequisites(
      [task('2026-03'), { id: 'adhoc', planStepId: null, period: '2026-03' }],
      prerequisites,
      status([['s-B01', '2026-03', TaskStatus.IN_PROGRESS]]),
    );
    expect(unmet.get('t-2026-03')).toEqual(['Bước B01']);
    expect(unmet.has('adhoc')).toBe(false);
  });
});

describe('periodProgress — tiến độ theo kỳ', () => {
  it('kỳ hoàn tất khi mọi việc bắt buộc Hoàn thành; việc tuỳ chọn không chặn', () => {
    const rows = periodProgress([
      { period: '2026-02', status: TaskStatus.COMPLETED, required: true },
      { period: '2026-02', status: TaskStatus.NOT_STARTED, required: false },
      { period: '2026-01', status: TaskStatus.COMPLETED, required: true },
      { period: '2026-01', status: TaskStatus.APPROVED, required: true },
    ]);
    expect(rows).toEqual([
      { period: '2026-01', total: 2, completed: 1, done: false },
      { period: '2026-02', total: 1, completed: 1, done: true },
    ]);
  });

  it('kỳ chỉ có việc tuỳ chọn thì xét mọi việc', () => {
    expect(
      periodProgress([
        { period: '2026-03', status: TaskStatus.IN_PROGRESS, required: false },
      ]),
    ).toEqual([{ period: '2026-03', total: 1, completed: 0, done: false }]);
  });
});
