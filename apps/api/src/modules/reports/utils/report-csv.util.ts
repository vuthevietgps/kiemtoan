import type { ReportsService } from '../reports.service';
import { toCsv } from './csv.util';

type Result<K extends keyof ReportsService> = Awaited<
  ReturnType<ReportsService[K]>
>;

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
