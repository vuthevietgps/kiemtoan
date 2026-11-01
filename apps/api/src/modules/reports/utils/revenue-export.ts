import { Prisma } from '@prisma/client';
import { xlsxWorkbook } from '../../../common/types/xlsx-workbook';
import type { FinanceReportsService } from '../finance-reports.service';
import { toCsv } from './csv.util';
import type { Measure, RevenueGroup } from './revenue-measures';

/** Excel / CSV báo cáo Doanh thu (10-D, M10): cùng số với màn hình — nhóm, 3 thước đo, cùng kỳ năm trước. */

type Revenue = Awaited<ReturnType<FinanceReportsService['revenue']>>;

export const GROUP_LABELS: Record<RevenueGroup, string> = {
  serviceType: 'Loại dịch vụ',
  customer: 'Khách hàng',
  owner: 'Người phụ trách',
  month: 'Tháng',
};

const vn = (d: string) => d.split('-').reverse().join('/');
const num = (v: Prisma.Decimal | null) => (v === null ? '' : v.toNumber());
const pct = (r: number | null) => (r === null ? '' : `${r}%`);

const HEADERS = (group: RevenueGroup) => [
  GROUP_LABELS[group],
  'Số HĐ duyệt',
  'Giá trị HĐ (trước VAT)',
  'Cùng kỳ năm trước',
  '± %',
  'Đã xuất hoá đơn (trước VAT)',
  'Cùng kỳ năm trước',
  '± %',
  'Đã thu (gồm VAT)',
  'Cùng kỳ năm trước',
  '± %',
];

function rows(r: Revenue): (string | number)[][] {
  const line = (
    name: string,
    x: {
      contracts: number;
      contractValue: Prisma.Decimal | null;
      invoiced: Prisma.Decimal | null;
      paid: Prisma.Decimal | null;
      previous: Record<Measure, Prisma.Decimal | null>;
      change: Record<Measure, number | null>;
    },
  ) => [
    name,
    x.contracts,
    num(x.contractValue),
    num(x.previous.contractValue),
    pct(x.change.contractValue),
    num(x.invoiced),
    num(x.previous.invoiced),
    pct(x.change.invoiced),
    num(x.paid),
    num(x.previous.paid),
    pct(x.change.paid),
  ];
  return [
    ...r.rows.map((row) => line(row.name, row)),
    line('Tổng cộng', r.totals),
  ];
}

export function revenueXlsx(r: Revenue): Buffer {
  return xlsxWorkbook(
    [
      ['Báo cáo doanh thu'],
      [
        `Kỳ: ${vn(r.from)} – ${vn(r.to)}; cùng kỳ năm trước ${vn(r.previousFrom)} – ${vn(r.previousTo)}`,
      ],
      [],
      HEADERS(r.groupBy),
      ...rows(r),
    ],
    'Doanh thu',
  );
}

export function revenueCsv(r: Revenue): string {
  return toCsv(HEADERS(r.groupBy), rows(r));
}
