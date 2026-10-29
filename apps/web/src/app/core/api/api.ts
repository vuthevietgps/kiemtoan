/** Đường dẫn gốc của API. Khi chạy dev, proxy.conf.json chuyển /api sang http://localhost:3000. */
export const API_URL = '/api/v1';

/** Kết quả trả về của mọi API danh sách. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Bỏ các tham số rỗng trước khi gửi lên query string. */
export function toParams(
  query: Record<string, string | number | boolean | null | undefined>,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') {
      params[key] = String(value);
    }
  }
  return params;
}

/** Lấy thông báo lỗi tiếng Việt từ phản hồi của API. */
export function errorMessage(err: unknown): string {
  const body = (err as { error?: { message?: string | string[] } })?.error;
  const message = body?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? 'Có lỗi xảy ra, vui lòng thử lại';
}
