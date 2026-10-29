/** 'YYYY-MM-DD' theo giờ máy người dùng — dùng cho ngày nghiệp vụ gửi lên API. */
export function toDateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Ngày nghiệp vụ 'YYYY-MM-DD' (có thể kèm giờ) → Date 00:00 giờ máy, cho ô chọn ngày. */
export function fromDateKey(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
