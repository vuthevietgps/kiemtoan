/** Hàm định dạng dùng chung cho Tổng quan và Báo cáo. */

const compactFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

/** Rút gọn tiền cho thẻ số liệu: 2850000000 → "2,85 tỷ", 120000000 → "120 tr". */
export function compactVnd(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${compactFormatter.format(n / 1e9)} tỷ`;
  if (abs >= 1e6) return `${compactFormatter.format(n / 1e6)} tr`;
  if (abs >= 1e3) return `${compactFormatter.format(n / 1e3)} nghìn`;
  return `${compactFormatter.format(n)} đ`;
}

/** Date → 'YYYY-MM-DD' theo giờ máy người dùng (ngày nghiệp vụ gửi lên API). */
export function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonthRange(): [Date, Date] {
  const now = new Date();
  return [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  ];
}

export function currentYearRange(): [Date, Date] {
  const y = new Date().getFullYear();
  return [new Date(y, 0, 1), new Date(y, 11, 31)];
}

/** Nhãn hạn công việc: "Còn N ngày" / "Hôm nay" / "Quá hạn N ngày" + màu nz-tag. */
export function dueLabel(daysLeft: number): { text: string; color: string } {
  if (daysLeft < 0) return { text: `Quá hạn ${-daysLeft} ngày`, color: 'red' };
  if (daysLeft === 0) return { text: 'Hôm nay', color: 'volcano' };
  if (daysLeft <= 3) return { text: `Còn ${daysLeft} ngày`, color: 'orange' };
  if (daysLeft <= 7) return { text: `Còn ${daysLeft} ngày`, color: 'gold' };
  return { text: `Còn ${daysLeft} ngày`, color: 'green' };
}

export const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Nháp', color: 'default' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'gold' },
  NOT_STARTED: { label: 'Chưa thực hiện', color: 'blue' },
  IN_PROGRESS: { label: 'Đang thực hiện', color: 'processing' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'green' },
  LIQUIDATED: { label: 'Thanh lý', color: 'purple' },
  CANCELLED: { label: 'Huỷ', color: 'red' },
};

/** Bảng màu biểu đồ thống nhất cho Tổng quan và Báo cáo. */
export const CHART_COLORS = ['#1f5fbf', '#2bb673', '#f5a623', '#e5534b', '#7b61ff', '#14a3b8'];
