import type { AssistantItem, Rate } from './capability.api';

/**
 * Ngưỡng màu mặc định (G8; chỉnh ở 11): tỷ lệ đúng hạn ≥ 95% xanh, 85–95% vàng, < 85% đỏ; trễ hạn pháp lý
 * > 0 luôn đỏ; tỷ lệ bị trả lại ≤ 10% xanh, 10–25% vàng, > 25% đỏ. Không có dữ liệu → không tô.
 */
export type Tone = 'good' | 'warn' | 'bad' | null;

export function onTimeTone(rate: Rate): Tone {
  if (rate === null) return null;
  return rate >= 95 ? 'good' : rate >= 85 ? 'warn' : 'bad';
}

export function returnTone(rate: Rate): Tone {
  if (rate === null) return null;
  return rate <= 10 ? 'good' : rate <= 25 ? 'warn' : 'bad';
}

export const statutoryTone = (count: number): Tone => (count > 0 ? 'bad' : null);

export const rateText = (rate: Rate) => (rate === null ? '—' : `${rate}%`);

/** Ô bấm của dòng trợ lý → lọc danh sách việc tương ứng (con số tái lập được từ danh sách). */
export type AssistantCell =
  | 'total'
  | 'ON_TIME'
  | 'LATE'
  | 'OVERDUE'
  | 'ORIGINAL_MISSED'
  | 'STATUTORY'
  | 'CLIENT'
  | 'EXTENDED'
  | 'RETURNED';

export const ASSISTANT_CELL_LABELS: Record<AssistantCell, string> = {
  total: 'Việc có hạn trong kỳ',
  ON_TIME: 'Đúng hạn',
  LATE: 'Trễ',
  OVERDUE: 'Quá hạn chưa nộp',
  ORIGINAL_MISSED: 'Không đạt hạn gốc',
  STATUTORY: 'Trễ hạn pháp lý',
  CLIENT: 'Trễ do khách',
  EXTENDED: 'Có gia hạn',
  RETURNED: 'Bị trả lại',
};

const missed = (r: string) => r === 'LATE' || r === 'OVERDUE';

export function filterTasks(tasks: AssistantItem[], cell: AssistantCell | null): AssistantItem[] {
  if (!cell) return tasks;
  const counted = tasks.filter((t) => t.counted);
  switch (cell) {
    case 'total':
      return counted;
    case 'ORIGINAL_MISSED':
      return counted.filter((t) => missed(t.originalResult));
    case 'STATUTORY':
      return counted.filter((t) => t.statutoryLate);
    case 'CLIENT':
      return counted.filter((t) => t.clientDelay);
    case 'EXTENDED':
      return counted.filter((t) => t.extensions > 0);
    case 'RETURNED':
      return counted.filter((t) => t.milestone && t.returnCount > 0);
    default:
      return counted.filter((t) => t.result === cell);
  }
}
