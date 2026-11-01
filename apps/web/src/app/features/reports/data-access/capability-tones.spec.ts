import { describe, expect, it } from 'vitest';
import type { AssistantItem, CapabilityReport, TeamRow } from './capability.api';
import { capabilityPrintable } from './capability-print';
import { filterTasks, onTimeTone, returnTone, statutoryTone } from './capability-tones';

const task = (id: string, patch: Partial<AssistantItem> = {}): AssistantItem => ({
  id,
  code: id,
  title: id,
  customer: { id: 'c', name: 'Công ty A' },
  status: 'COMPLETED',
  dueDate: '2026-05-10',
  originalDueDate: '2026-05-10',
  milestone: '2026-05-10',
  counted: true,
  result: 'ON_TIME',
  days: 0,
  originalResult: 'ON_TIME',
  waitDays: 0,
  clientDelay: false,
  statutory: false,
  statutoryLate: false,
  extensions: 0,
  returnCount: 0,
  ...patch,
});

describe('capability tones (G8)', () => {
  it('tỷ lệ đúng hạn: ≥ 95 xanh, 85–95 vàng, < 85 đỏ, không có dữ liệu không tô', () => {
    expect([95, 94.9, 85, 84.9].map(onTimeTone)).toEqual(['good', 'warn', 'warn', 'bad']);
    expect(onTimeTone(null)).toBeNull();
  });

  it('bị trả lại: ≤ 10 xanh, ≤ 25 vàng, > 25 đỏ; trễ hạn pháp lý > 0 luôn đỏ', () => {
    expect([10, 25, 25.1].map(returnTone)).toEqual(['good', 'warn', 'bad']);
    expect(statutoryTone(0)).toBeNull();
    expect(statutoryTone(1)).toBe('bad');
  });
});

describe('filterTasks — ô bấm ra danh sách', () => {
  const tasks = [
    task('A'),
    task('B', { result: 'LATE', days: 2, originalResult: 'LATE', returnCount: 1 }),
    task('C', { result: 'OVERDUE', milestone: null, originalResult: 'OVERDUE' }),
    task('D', { statutory: true, statutoryLate: true, result: 'LATE' }),
    task('E', { waitDays: 3, clientDelay: true, extensions: 1, originalResult: 'LATE' }),
    task('F', { counted: false, milestone: null }),
  ];
  const ids = (cell: Parameters<typeof filterTasks>[1]) =>
    filterTasks(tasks, cell).map((t) => t.id);

  it('không lọc: hiện cả việc không tính; "Việc có hạn" chỉ việc được tính', () => {
    expect(ids(null)).toHaveLength(6);
    expect(ids('total')).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('từng ô khớp số trên dòng', () => {
    expect(ids('ON_TIME')).toEqual(['A', 'E']);
    expect(ids('LATE')).toEqual(['B', 'D']);
    expect(ids('OVERDUE')).toEqual(['C']);
    expect(ids('ORIGINAL_MISSED')).toEqual(['B', 'C', 'E']);
    expect(ids('STATUTORY')).toEqual(['D']);
    expect(ids('CLIENT')).toEqual(['E']);
    expect(ids('EXTENDED')).toEqual(['E']);
    expect(ids('RETURNED')).toEqual(['B']);
  });
});

describe('capabilityPrintable', () => {
  const row: TeamRow = {
    user: { id: 'u', fullName: 'An', teamId: null },
    periods: {
      total: 2,
      onTime: 1,
      late: 1,
      overdue: 0,
      rate: 50,
      rateOriginal: null,
      statutoryLate: 0,
      extendedRate: 50,
    },
    audit: null,
    reviews: { count: 2, avgDays: 1.5, withinSla: 1, slaRate: 50, returned: 1, overSlaNow: 0 },
  };
  const report = (domain: CapabilityReport['domain']): CapabilityReport => ({
    from: '2026-05-01',
    to: '2026-05-31',
    role: 'LEAD',
    domain,
    rows: [row],
  });

  it('cùng cột với màn hình theo mảng; ô không có dữ liệu là "—"; không có tiền', () => {
    const all = capabilityPrintable(report('ALL'));
    expect(all.headers).toHaveLength(13);
    expect(all.rows[0]).toEqual(['An', 2, '50%', '—', 0, '50%', '—', '—', '—', 2, 1.5, '50%', 0]);
    const accounting = capabilityPrintable(report('ACCOUNTING'));
    expect(accounting.headers).not.toContain('Hạn hồ sơ KiT');
    expect(accounting.rows[0]).toHaveLength(10);
    expect(JSON.stringify(all)).not.toMatch(/doanh thu|VND|₫/i);
  });
});
