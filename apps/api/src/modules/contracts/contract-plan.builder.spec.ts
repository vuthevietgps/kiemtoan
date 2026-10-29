import { WorkflowScheduleMode } from '@prisma/client';
import {
  activeSteps,
  applyStepChanges,
  PlanError,
  PlanStepInput,
  scheduleDates,
  suggestAssignee,
} from './contract-plan.builder';

const day = (v: string) => new Date(`${v}T00:00:00.000Z`);
const iso = (d: Date | null) => d && d.toISOString().slice(0, 10);
const step = (
  stepKey: string,
  extra: Partial<PlanStepInput> = {},
): PlanStepInput => ({
  stepKey,
  required: true,
  skipped: false,
  durationDays: null,
  dueOffsetDays: null,
  dependsOn: [],
  ...extra,
});

describe('activeSteps', () => {
  it('bỏ bước bị bỏ qua và nối bước sau vào các bước nó chờ (kể cả nhiều bậc)', () => {
    const steps = [
      step('A'),
      step('B', { dependsOn: ['A'], skipped: true, required: false }),
      step('C', { dependsOn: ['B'], skipped: true, required: false }),
      step('D', { dependsOn: ['C', 'A'] }),
    ];
    expect(activeSteps(steps).map((s) => [s.stepKey, s.dependsOn])).toEqual([
      ['A', []],
      ['D', ['A']],
    ]);
  });
});

describe('scheduleDates', () => {
  // Giá trị kỳ vọng chuyển từ task-generator.spec (trước 04-B bộ sinh việc tự tính hạn).
  it('theo kỳ: hạn = cuối kỳ + số ngày lệch', () => {
    const dates = scheduleDates(
      WorkflowScheduleMode.PERIODIC,
      [step('B01', { dueOffsetDays: 5 }), step('B02', { dueOffsetDays: 20 })],
      day('2025-09-15'),
      '2025-10',
    );
    expect(iso(dates.get('B02')!.dueDate)).toBe('2025-11-20');
    expect(iso(dates.get('B01')!.dueDate)).toBe('2025-11-05');
  });

  it('theo dự án: tính từ ngày bắt đầu theo ngày làm việc', () => {
    const dates = scheduleDates(
      WorkflowScheduleMode.PROJECT,
      [
        step('B01', { durationDays: 2 }),
        step('B02', { durationDays: 3, dependsOn: ['B01'] }),
      ],
      day('2025-09-15'),
      '2025-09',
    );
    // HĐ bắt đầu thứ 2 15/09/2025: B01 15–16/09, B02 17–19/09.
    expect(iso(dates.get('B01')!.dueDate)).toBe('2025-09-16');
    expect(iso(dates.get('B02')!.dueDate)).toBe('2025-09-19');
  });

  it('bỏ bước tuỳ chọn thì bước sau bắt đầu sớm hơn', () => {
    const dates = scheduleDates(
      WorkflowScheduleMode.PROJECT,
      [
        step('B01', { durationDays: 2 }),
        step('B02', {
          durationDays: 3,
          dependsOn: ['B01'],
          skipped: true,
          required: false,
        }),
        step('B03', { durationDays: 1, dependsOn: ['B02'] }),
      ],
      day('2026-11-02'),
      '2026-11',
    );
    expect(iso(dates.get('B03')!.plannedStart)).toBe('2026-11-04');
  });
});

describe('suggestAssignee', () => {
  it('ưu tiên người mặc định của bước còn hoạt động, sau đó dòng dịch vụ → HĐ → KH', () => {
    const active = new Set(['u1']);
    expect(suggestAssignee('u1', active, 'line', 'owner', 'cust')).toBe('u1');
    expect(suggestAssignee('left', active, 'line', 'owner', 'cust')).toBe(
      'line',
    );
    expect(suggestAssignee(null, active, null, 'owner', 'cust')).toBe('owner');
    expect(suggestAssignee(null, active, null, null, 'cust')).toBe('cust');
    expect(suggestAssignee(null, active, null, null, null)).toBeNull();
  });
});

describe('applyStepChanges', () => {
  const named = (key: string, extra: Partial<PlanStepInput> = {}) => ({
    ...step(key, extra),
    name: `Bước ${key}`,
    assigneeId: 'u1' as string | null,
  });

  it('chỉ đổi trường được gửi, không sửa mảng gốc', () => {
    const steps = [
      named('A', { durationDays: 2 }),
      named('B', { required: false }),
    ];
    const result = applyStepChanges(steps, [
      { stepKey: 'A', durationDays: 5, assigneeId: undefined },
      { stepKey: 'B', skipped: true, assigneeId: null },
    ]);
    expect(result[0]).toMatchObject({ durationDays: 5, assigneeId: 'u1' });
    expect(result[1]).toMatchObject({ skipped: true, assigneeId: null });
    expect(steps[1].skipped).toBe(false);
  });

  it('từ chối bước lạ và bỏ bước bắt buộc', () => {
    const steps = [named('A')];
    expect(() => applyStepChanges(steps, [{ stepKey: 'X' }])).toThrow(
      PlanError,
    );
    expect(() =>
      applyStepChanges(steps, [{ stepKey: 'A', skipped: true }]),
    ).toThrow('bắt buộc');
  });
});
