/** Tiện ích nhập liệu dùng chung cho các form của contracts / payments / invoices / service-catalog. */

const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** Hiển thị số tiền trong nz-input-number: 1500000 → "1.500.000". */
export const moneyFormatter = (value: number): string =>
  value === null || value === undefined || Number.isNaN(value) ? '' : numberFormat.format(value);

/** Đọc lại số tiền người dùng gõ: "1.500.000" → 1500000. */
export const moneyParser = (value: string): number => Number(value.replace(/\D/g, '')) || 0;

/** Date của nz-date-picker → 'YYYY-MM-DD' theo giờ địa phương (API nhận ngày nghiệp vụ dạng này). */
export function toDateString(date: Date | null | undefined): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Chuỗi ngày từ API ('2025-01-01T00:00:00.000Z') → Date cho nz-date-picker. */
export function fromDateString(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Số tiền dạng rút gọn cho tag: 120000000 → "120 tr", 1500000000 → "1,5 tỷ". */
export function shortMoney(value: string | number): string {
  const n = Number(value);
  const short = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 1e9) return `${short.format(n / 1e9)} tỷ`;
  if (Math.abs(n) >= 1e6) return `${short.format(n / 1e6)} tr`;
  return `${numberFormat.format(n)} đ`;
}
