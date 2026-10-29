import { Role, WorkflowScheduleMode } from '@prisma/client';

/** Kiểm tra nội dung phiên bản quy trình (đặc tả 03-B), trả về thông báo tiếng Việt chỉ rõ bước lỗi. */

export interface WorkflowStepInput {
  key: string;
  name: string;
  dependsOn: string[];
  durationDays?: number | null;
  dueOffsetDays?: number | null;
  reviewLevels: number;
  reviewerRole?: Role | null;
  defaultReviewerId?: string | null;
}

export const MAX_STEPS = 100;
export const MAX_DEPENDENCIES = 20;
export const MAX_REQUIREMENTS = 100;

export interface RequirementInput {
  name: string;
  stepKey?: string | null;
}

const label = (step: WorkflowStepInput) => `Bước "${step.name}" (${step.key})`;

/** Một vòng phụ thuộc (danh sách khoá bước, phần tử đầu lặp lại ở cuối) hoặc null. */
export function findCycle(steps: WorkflowStepInput[]): string[] | null {
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (key: string): string[] | null => {
    if (state.get(key) === 'done') return null;
    if (state.get(key) === 'visiting') {
      return [...stack.slice(stack.indexOf(key)), key];
    }
    state.set(key, 'visiting');
    stack.push(key);
    for (const dep of byKey.get(key)?.dependsOn ?? []) {
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(key, 'done');
    return null;
  };
  for (const step of steps) {
    const cycle = visit(step.key);
    if (cycle) return cycle;
  }
  return null;
}

/** Lỗi cấu trúc chặn cả khi lưu nháp: trùng khoá, phụ thuộc không tồn tại/chính nó, vòng. */
export function structureError(steps: WorkflowStepInput[]): string | null {
  if (steps.length > MAX_STEPS) return `Phiên bản tối đa ${MAX_STEPS} bước`;
  const keys = new Set<string>();
  for (const step of steps) {
    if (keys.has(step.key)) return `Khoá bước ${step.key} bị trùng`;
    keys.add(step.key);
  }
  for (const step of steps) {
    if (step.dependsOn.length > MAX_DEPENDENCIES)
      return `${label(step)}: tối đa ${MAX_DEPENDENCIES} bước phụ thuộc`;
    if (new Set(step.dependsOn).size !== step.dependsOn.length)
      return `${label(step)}: một bước phụ thuộc bị chọn lặp lại`;
    for (const dep of step.dependsOn) {
      if (dep === step.key)
        return `${label(step)}: không được phụ thuộc vào chính nó`;
      if (!keys.has(dep))
        return `${label(step)}: bước phụ thuộc ${dep} không có trong phiên bản`;
    }
  }
  const cycle = findCycle(steps);
  if (cycle) {
    const names = new Map(steps.map((s) => [s.key, s.name]));
    return `Vòng phụ thuộc: ${cycle.map((k) => `"${names.get(k)}"`).join(' → ')}`;
  }
  return null;
}

/** Kiểm tra đầy đủ trước khi phát hành (gồm cả lỗi cấu trúc). */
export function publishError(
  mode: WorkflowScheduleMode,
  steps: WorkflowStepInput[],
): string | null {
  if (steps.length === 0) return 'Phiên bản cần ít nhất một bước để phát hành';
  const structure = structureError(steps);
  if (structure) return structure;
  for (const step of steps) {
    if (mode === WorkflowScheduleMode.PROJECT) {
      const days = step.durationDays;
      if (days == null || days < 1 || days > 365)
        return `${label(step)}: thời lượng phải từ 1 đến 365 ngày làm việc`;
    } else if (step.dueOffsetDays == null) {
      return `${label(step)}: cần số ngày lệch so với cuối kỳ`;
    }
    if (
      step.reviewLevels >= 1 &&
      !step.reviewerRole &&
      !step.defaultReviewerId
    ) {
      return `${label(step)}: có cấp duyệt thì phải chọn vai trò hoặc người kiểm tra`;
    }
  }
  return null;
}

/** Hồ sơ yêu cầu chỉ được gắn với bước có trong cùng phiên bản; tên không trùng nhau. */
export function requirementError(
  steps: { key: string }[],
  requirements: RequirementInput[],
): string | null {
  if (requirements.length > MAX_REQUIREMENTS)
    return `Phiên bản tối đa ${MAX_REQUIREMENTS} hồ sơ yêu cầu`;
  const keys = new Set(steps.map((s) => s.key));
  const names = new Set<string>();
  for (const req of requirements) {
    const name = req.name.trim().toLocaleLowerCase('vi');
    if (names.has(name)) return `Hồ sơ "${req.name.trim()}" bị trùng tên`;
    names.add(name);
    if (req.stepKey && !keys.has(req.stepKey))
      return `Hồ sơ "${req.name.trim()}": bước ${req.stepKey} không có trong phiên bản`;
  }
  return null;
}
