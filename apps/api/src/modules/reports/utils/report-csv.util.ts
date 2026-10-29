import type { ReportsService } from '../reports.service';
import { toCsv } from './csv.util';
import type { RevenueGroupBy } from './report-grouping.util';

type Result<K extends keyof ReportsService> = Awaited<
  ReturnType<ReportsService[K]>
>;

const GROUP_LABELS: Record<RevenueGroupBy, string> = {
  serviceType: 'Loại dịch vụ',
  customer: 'Khách hàng',
  owner: 'Người phụ trách',
  month: 'Tháng',
};

const rate = (value: number | null) => (value === null ? '' : `${value}%`);

export function revenueCsv(data: Result<'revenue'>): string {
  return toCsv(
    [
      GROUP_LABELS[data.groupBy],
      'Số hợp đồng',
      'Doanh thu chưa VAT',
      'Tổng thanh toán',
    ],
    [
      ...data.rows.map((r) => [r.name, r.contracts, r.subtotal, r.total]),
      [
        'Tổng cộng',
        data.totals.contracts,
        data.totals.subtotal,
        data.totals.total,
      ],
    ],
  );
}

export function receivablesCsv(data: Result<'receivables'>): string {
  return toCsv(
    [
      'Khách hàng',
      'Mã số thuế',
      'Số hợp đồng',
      'Tổng phải thu',
      'Đã thu',
      'Còn lại',
      'Quá hạn',
    ],
    data.rows.map((r) => [
      r.customerName,
      r.taxCode,
      r.contracts,
      r.total,
      r.paid,
      r.remaining,
      r.overdue,
    ]),
  );
}

export function complianceCsv(data: Result<'taskCompliance'>): string {
  const headers = [
    'Nhóm',
    'Tên',
    'Đúng hạn',
    'Trễ hạn',
    'Chưa xong đã quá hạn',
    'Tỷ lệ đúng hạn',
  ];
  return toCsv(headers, [
    ...data.byMonth.map((m) => [
      'Tháng',
      m.month,
      m.onTime,
      m.late,
      m.overdueOpen,
      rate(m.onTimeRate),
    ]),
    ...data.byStaff.map((s) => [
      'Nhân viên',
      s.name,
      s.onTime,
      s.late,
      s.overdueOpen,
      rate(s.onTimeRate),
    ]),
  ]);
}

export function staffPerformanceCsv(
  data: Result<'staffPerformance'>,
  financial = true,
): string {
  return toCsv(
    [
      'Nhân viên',
      'Nhóm',
      'Việc hoàn thành',
      'Đúng hạn',
      'Trễ hạn',
      'Tỷ lệ đúng hạn',
      'Khách hàng phụ trách',
      ...(financial ? ['Doanh thu HĐ phụ trách'] : []),
    ],
    data.rows.map((r) => [
      r.fullName,
      r.teamName,
      r.tasksDone,
      r.onTime,
      r.late,
      rate(r.onTimeRate),
      r.customers,
      ...(financial ? [r.revenue] : []),
    ]),
  );
}
