import type { AssistantRow, CapabilityReport, TeamRow } from './capability.api';
import { rateText as pct } from './capability-tones';
import type { PrintableReport } from './print-report';

const ROLE = { ASSISTANT: 'Trợ lý', LEAD: 'Trưởng nhóm', MANAGER: 'Manager' };
const DOMAIN = { ALL: 'Kế toán + kiểm toán', ACCOUNTING: 'Kế toán dịch vụ', AUDIT: 'Kiểm toán' };

/** Bản in Đánh giá năng lực (10-E): cùng cột với màn hình / Excel; không có số tiền. */
export function capabilityPrintable(r: CapabilityReport): Omit<PrintableReport, 'printedBy'> {
  const base = {
    title: `Đánh giá năng lực — ${ROLE[r.role]}`,
    period: { from: r.from, to: r.to },
    summary: [
      ['Mảng', DOMAIN[r.domain]],
      ['Số người', r.rows.length],
    ] as [string, string | number][],
  };
  return { ...base, ...(r.role === 'ASSISTANT' ? assistantTable(r) : teamTable(r)) };
}

type Table = Pick<PrintableReport, 'headers' | 'rows'>;

function assistantTable(r: CapabilityReport): Table {
  const rows = r.rows as AssistantRow[];
  return {
    headers: [
      'Người',
      'Việc có hạn',
      'Đúng hạn',
      'Trễ',
      'Quá hạn',
      'Tỷ lệ đúng hạn',
      'Đúng hạn gốc',
      'Trễ hạn pháp lý',
      'Trễ do khách',
      'Gia hạn',
      'Tỷ lệ bị trả lại',
      'Được chấp nhận',
      'KH đang làm',
    ],
    rows: rows.map((x) => [
      x.user.fullName,
      x.total,
      x.onTime,
      x.late,
      x.overdue,
      pct(x.rate),
      pct(x.rateOriginal),
      x.statutoryLate,
      x.clientDelay,
      x.extensions,
      pct(x.returnRate),
      x.accepted,
      x.openCustomers,
    ]),
  };
}

function teamTable(r: CapabilityReport): Table {
  const lead = r.role === 'LEAD';
  const accounting = r.domain !== 'AUDIT';
  const audit = r.domain !== 'ACCOUNTING';
  const rows = r.rows as TeamRow[];
  return {
    headers: [
      'Người',
      ...(accounting
        ? [
            'Kỳ dịch vụ (KT)',
            'Tỷ lệ đúng hạn (KT)',
            'Đúng hạn gốc (KT)',
            'Trễ hạn pháp lý',
            'Tỷ lệ gia hạn',
          ]
        : []),
      ...(audit ? ['Hạn hồ sơ KiT', 'Tỷ lệ đúng hạn (KiT)', 'Đúng hạn gốc (KiT)'] : []),
      ...(lead ? ['Lượt soát xét', 'TB ngày làm việc', 'Trong SLA', 'Đang quá SLA'] : []),
    ],
    rows: rows.map((x) => [
      x.user.fullName,
      ...(accounting
        ? [
            x.periods.total,
            pct(x.periods.rate),
            pct(x.periods.rateOriginal),
            x.periods.statutoryLate,
            pct(x.periods.extendedRate),
          ]
        : []),
      ...(audit
        ? x.audit
          ? [x.audit.total, pct(x.audit.rate), pct(x.audit.rateOriginal)]
          : ['—', '—', '—']
        : []),
      ...(lead && x.reviews
        ? [x.reviews.count, x.reviews.avgDays ?? '—', pct(x.reviews.slaRate), x.reviews.overSlaNow]
        : []),
    ]),
  };
}
