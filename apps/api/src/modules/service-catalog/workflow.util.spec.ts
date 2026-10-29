import { Role, WorkflowScheduleMode } from '@prisma/client';
import {
  findCycle,
  publishError,
  requirementError,
  structureError,
  WorkflowStepInput,
} from './workflow.util';

const step = (
  key: string,
  dependsOn: string[] = [],
  extra: Partial<WorkflowStepInput> = {},
): WorkflowStepInput => ({
  key,
  name: `Bước ${key}`,
  dependsOn,
  reviewLevels: 0,
  ...extra,
});

describe('findCycle / structureError', () => {
  it('chấp nhận phụ thuộc không vòng, kể cả song song', () => {
    const steps = [
      step('A'),
      step('B', ['A']),
      step('C', ['A']),
      step('D', ['B', 'C']),
    ];
    expect(findCycle(steps)).toBeNull();
    expect(structureError(steps)).toBeNull();
  });

  it('phát hiện vòng và nêu tên các bước trong vòng', () => {
    const steps = [
      step('A', ['C']),
      step('B', ['A']),
      step('C', ['B']),
      step('D'),
    ];
    expect(findCycle(steps)).toEqual(['A', 'C', 'B', 'A']);
    expect(structureError(steps)).toBe(
      'Vòng phụ thuộc: "Bước A" → "Bước C" → "Bước B" → "Bước A"',
    );
  });

  it('từ chối tự phụ thuộc, phụ thuộc không tồn tại và trùng khoá', () => {
    expect(structureError([step('A', ['A'])])).toMatch(
      /không được phụ thuộc vào chính nó/,
    );
    expect(structureError([step('A', ['X'])])).toMatch(
      /bước phụ thuộc X không có trong phiên bản/,
    );
    expect(structureError([step('A'), step('A')])).toBe('Khoá bước A bị trùng');
    expect(structureError([step('A'), step('B', ['A', 'A'])])).toMatch(
      /chọn lặp lại/,
    );
  });
});

describe('publishError', () => {
  it('không phát hành phiên bản rỗng', () => {
    expect(publishError(WorkflowScheduleMode.PERIODIC, [])).toMatch(
      /ít nhất một bước/,
    );
  });

  it('theo dự án cần thời lượng 1–365, theo kỳ cần số ngày lệch', () => {
    expect(publishError(WorkflowScheduleMode.PROJECT, [step('A')])).toBe(
      'Bước "Bước A" (A): thời lượng phải từ 1 đến 365 ngày làm việc',
    );
    expect(publishError(WorkflowScheduleMode.PERIODIC, [step('A')])).toMatch(
      /cần số ngày lệch/,
    );
    expect(
      publishError(WorkflowScheduleMode.PROJECT, [
        step('A', [], { durationDays: 2 }),
      ]),
    ).toBeNull();
  });

  it('có cấp duyệt thì phải có người hoặc vai trò kiểm tra', () => {
    const base = { dueOffsetDays: 5, reviewLevels: 1 };
    expect(
      publishError(WorkflowScheduleMode.PERIODIC, [step('A', [], base)]),
    ).toMatch(/vai trò hoặc người kiểm tra/);
    expect(
      publishError(WorkflowScheduleMode.PERIODIC, [
        step('A', [], { ...base, reviewerRole: Role.MANAGER }),
      ]),
    ).toBeNull();
  });

  it('chạy cả kiểm tra cấu trúc', () => {
    expect(
      publishError(WorkflowScheduleMode.PROJECT, [
        step('A', ['B'], { durationDays: 1 }),
        step('B', ['A'], { durationDays: 1 }),
      ]),
    ).toMatch(/^Vòng phụ thuộc/);
  });
});

describe('requirementError', () => {
  const steps = [{ key: 'B01' }, { key: 'B02' }];

  it('chấp nhận hồ sơ gắn bước có trong phiên bản hoặc không gắn bước', () => {
    expect(
      requirementError(steps, [
        { name: 'Tờ khai thuế GTGT', stepKey: 'B02' },
        { name: 'Hồ sơ xuất khẩu' },
      ]),
    ).toBeNull();
  });

  it('từ chối bước không tồn tại và tên trùng (không phân biệt hoa thường)', () => {
    expect(
      requirementError(steps, [{ name: 'Bảng lương', stepKey: 'B09' }]),
    ).toBe('Hồ sơ "Bảng lương": bước B09 không có trong phiên bản');
    expect(
      requirementError(steps, [{ name: 'Bảng kê' }, { name: ' bảng KÊ ' }]),
    ).toBe('Hồ sơ "bảng KÊ" bị trùng tên');
  });
});
