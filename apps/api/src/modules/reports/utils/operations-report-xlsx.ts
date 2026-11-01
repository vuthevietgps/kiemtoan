import { xlsxWorkbook } from '../../../common/types/xlsx-workbook';
import type { OperationsReportsService } from '../operations-reports.service';

/**
 * Excel báo cáo vận hành (10-C, M10): dòng tiêu đề + kỳ, dòng tổng hợp, rồi danh sách chi tiết — cùng số
 * với màn hình. Ngày dạng dd/mm/yyyy; số lượng / tiền ghi dạng số.
 */

type Service = OperationsReportsService;
type Compliance = Awaited<ReturnType<Service['deadlineCompliance']>>;
type Contracts = Awaited<ReturnType<Service['contracts']>>;
type Customers = Awaited<ReturnType<Service['customers']>>;

const vn = (d: string | null) => (d ? d.split('-').reverse().join('/') : '');
const pct = (r: number | null) => (r === null ? '—' : `${r}%`);
const yes = (b: boolean) => (b ? 'Có' : '');
const head = (title: string, r: { from: string; to: string }) => [
  [title],
  [`Kỳ: ${vn(r.from)} – ${vn(r.to)}`],
];

const OUTCOME: Record<string, string> = {
  ON_TIME: 'Đúng hạn',
  LATE: 'Trễ',
  OVERDUE: 'Quá hạn chưa nộp',
  NOT_DUE: 'Chưa đến hạn',
};
const CATEGORY: Record<string, string> = {
  NEW: 'Mới duyệt',
  ACTIVE: 'Hiệu lực cuối kỳ',
  EXPIRING: 'Sắp hết hạn',
  ENDED: 'Kết thúc trong kỳ',
  RENEWED: 'Đã tái ký',
};

export function complianceXlsx(r: Compliance): Buffer {
  const s = r.summary;
  return xlsxWorkbook(
    [
      ...head('Báo cáo tuân thủ deadline', r),
      ['Đúng hạn', s.onTime, 'Trễ', s.late, 'Quá hạn chưa nộp', s.overdue],
      [
        'Chưa đến hạn',
        s.notDue,
        'Do khách chậm',
        s.clientDelay,
        'Tỷ lệ đúng hạn',
        pct(s.onTimeRate),
      ],
      [],
      [
        'Khách hàng',
        'Hạn / báo cáo',
        'Hạn',
        'Ngày nộp / xong',
        'Kết quả',
        'Số ngày trễ',
        'Do khách chậm',
      ],
      ...r.items.map((i) => [
        i.customerName,
        i.title,
        vn(i.dueDate),
        vn(i.doneOn),
        OUTCOME[i.outcome],
        i.daysLate,
        yes(i.clientDelay),
      ]),
    ],
    'Tuan thu deadline',
  );
}

export function contractsXlsx(r: Contracts): Buffer {
  const s = r.summary;
  const money = r.items.some((i) => 'subtotal' in i);
  return xlsxWorkbook(
    [
      ...head('Báo cáo hợp đồng', r),
      [
        'Mới duyệt',
        s.newApproved,
        'Hiệu lực cuối kỳ',
        s.active,
        `Sắp hết hạn (${r.expiringDays} ngày)`,
        s.expiring,
      ],
      [
        'Kết thúc trong kỳ',
        s.ended,
        'Đã tái ký',
        s.renewed,
        'Tỷ lệ tái ký',
        pct(s.renewalRate),
      ],
      [],
      [
        'Mã HĐ',
        'Khách hàng',
        'Người phụ trách',
        'Ngày duyệt',
        'Bắt đầu',
        'Kết thúc',
        'Nhóm',
        'Tái ký bằng',
        ...(money ? ['Giá trị trước VAT'] : []),
      ],
      ...r.items.map((i) => [
        i.code,
        i.customerName,
        i.ownerName ?? '',
        vn(i.approvedOn),
        vn(i.startDate),
        vn(i.endDate),
        i.categories.map((c) => CATEGORY[c]).join(', '),
        i.renewedBy.join(', '),
        ...('subtotal' in i && i.subtotal !== undefined
          ? [Number(i.subtotal)]
          : []),
      ]),
    ],
    'Hop dong',
  );
}

export function customersXlsx(r: Customers): Buffer {
  const s = r.summary;
  return xlsxWorkbook(
    [
      ...head('Báo cáo khách hàng', r),
      [
        'Khách mới',
        s.newCustomers,
        'Khách ngừng',
        s.stopped,
        'Tỷ lệ giữ chân',
        pct(s.retentionRate),
      ],
      [
        'Có HĐ đầu kỳ',
        s.activeAtStart,
        'Còn HĐ cuối kỳ',
        s.activeAtEnd,
        'Giữ được',
        s.retained,
      ],
      [],
      [
        'Khách hàng',
        'MST',
        'Người phụ trách',
        'HĐ đầu tiên duyệt',
        'Ngừng từ',
        'Mới',
        'Ngừng',
        'Có HĐ đầu kỳ',
        'Còn HĐ cuối kỳ',
      ],
      ...r.items.map((i) => [
        i.name,
        i.taxCode,
        i.ownerName ?? '',
        vn(i.firstApprovedOn),
        vn(i.stoppedOn),
        yes(i.isNew),
        yes(i.stopped),
        yes(i.activeAtStart),
        yes(i.activeAtEnd),
      ]),
    ],
    'Khach hang',
  );
}
