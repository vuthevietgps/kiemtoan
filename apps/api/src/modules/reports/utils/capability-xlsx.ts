import { xlsxWorkbook } from '../../../common/types/xlsx-workbook';
import type { CapabilityService } from '../capability.service';

/** Excel Đánh giá năng lực (10-E): mỗi người một dòng, mỗi chỉ số một cột — cùng số với màn hình. */

type Report = Awaited<ReturnType<CapabilityService['report']>>;
type Rate = number | null;

const vn = (d: string) => d.split('-').reverse().join('/');
const pct = (r: Rate) => (r === null ? '—' : `${r}%`);
const ROLE = { ASSISTANT: 'Trợ lý', LEAD: 'Trưởng nhóm', MANAGER: 'Manager' };
const DOMAIN = {
  ACCOUNTING: 'Kế toán dịch vụ',
  AUDIT: 'Kiểm toán',
  ALL: 'Kế toán + kiểm toán',
};

type Cell = string | number;
type AnyRow = Record<string, unknown> & { user: { fullName: string } };

function assistantRows(rows: AnyRow[]): Cell[][] {
  return [
    [
      'Người',
      'Việc có hạn',
      'Đúng hạn',
      'Trễ',
      'Quá hạn',
      'Tỷ lệ đúng hạn',
      'Đúng hạn gốc',
      'Trễ hạn pháp lý',
      'Trễ do khách',
      'Số lần gia hạn',
      'Tỷ lệ bị trả lại',
      'Được chấp nhận',
      'KH đang làm',
    ],
    ...rows.map((r) => [
      r.user.fullName,
      r.total as number,
      r.onTime as number,
      r.late as number,
      r.overdue as number,
      pct(r.rate as Rate),
      pct(r.rateOriginal as Rate),
      r.statutoryLate as number,
      r.clientDelay as number,
      r.extensions as number,
      pct(r.returnRate as Rate),
      r.accepted as number,
      r.openCustomers as number,
    ]),
  ];
}

type Summary = {
  total: number;
  rate: Rate;
  rateOriginal: Rate;
  statutoryLate?: number;
  extendedRate?: Rate;
  extensions?: number;
};

function teamRows(rows: AnyRow[], lead: boolean): Cell[][] {
  return [
    [
      'Người',
      'Kỳ dịch vụ (KT)',
      'Tỷ lệ đúng hạn (KT)',
      'Đúng hạn gốc (KT)',
      'Trễ hạn pháp lý (KT)',
      'Tỷ lệ gia hạn (KT)',
      'Hạn hồ sơ (kiểm toán)',
      'Tỷ lệ đúng hạn (kiểm toán)',
      'Đúng hạn gốc (kiểm toán)',
      ...(lead
        ? ['Lượt soát xét', 'TB ngày làm việc', 'Trong SLA', 'Đang quá SLA']
        : []),
    ],
    ...rows.map((r) => {
      const p = r.periods as Summary;
      const a = r.audit as Summary | null;
      const v = r.reviews as
        | {
            count: number;
            avgDays: number | null;
            slaRate: Rate;
            overSlaNow: number;
          }
        | undefined;
      return [
        r.user.fullName,
        p.total,
        pct(p.rate),
        pct(p.rateOriginal),
        p.statutoryLate ?? 0,
        pct(p.extendedRate ?? null),
        a ? a.total : '—',
        a ? pct(a.rate) : '—',
        a ? pct(a.rateOriginal) : '—',
        ...(lead && v
          ? [v.count, v.avgDays ?? '—', pct(v.slaRate), v.overSlaNow]
          : []),
      ];
    }),
  ];
}

export function capabilityXlsx(r: Report): Buffer {
  const rows = r.rows as AnyRow[];
  return xlsxWorkbook(
    [
      [`Đánh giá năng lực — ${ROLE[r.role]} — ${DOMAIN[r.domain]}`],
      [`Kỳ: ${vn(r.from)} – ${vn(r.to)}`],
      [],
      ...(r.role === 'ASSISTANT'
        ? assistantRows(rows)
        : teamRows(rows, r.role === 'LEAD')),
    ],
    'Danh gia nang luc',
  );
}
