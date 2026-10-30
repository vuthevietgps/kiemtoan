import {
  CredentialEventType,
  CredentialType,
  TokenCustody,
  TokenProvider,
} from '@prisma/client';
import type { SettableCustody } from './dto/client-credential.dto';

/**
 * Quy tắc thuần của kho tài khoản (đặc tả 09): bắt buộc theo loại (L1, L2), chuẩn hoá serial, hạn mượn
 * (L4), sự kiện khi đổi nơi giữ (L3–L4), nhóm sự kiện lịch sử / nhật ký truy cập (L8). Không đọc DB.
 */

const DAY_MS = 86_400_000;
/** L4: hạn trả tối đa tính từ hôm nay. */
export const MAX_LOAN_DAYS = 30;
/** Cảnh báo "sắp hết hạn" trên danh sách (đặc tả 09, màn hình). */
export const EXPIRY_WARNING_DAYS = 30;

/** L6/L8: sự kiện xem/sao chép chỉ hiện ở nhật ký truy cập, không ở lịch sử. */
export const ACCESS_EVENTS: CredentialEventType[] = [
  CredentialEventType.SECRET_VIEWED,
  CredentialEventType.SECRET_COPIED,
];

export const isToken = (type: CredentialType) =>
  type === CredentialType.DIGITAL_SIGNATURE;

export function normalizeSerial(serial: string | null | undefined) {
  const value = serial?.trim().toUpperCase();
  return value ? value : null;
}

/** Trạng thái sau khi gộp dữ liệu cũ và dữ liệu gửi lên — dùng để kiểm tra bắt buộc. */
export interface CredentialShape {
  type: CredentialType;
  label: string | null;
  username: string | null;
  hasSecret: boolean;
  expiresAt: Date | null;
  provider: TokenProvider | null;
  serialNumber: string | null;
}

/** Trả lỗi đầu tiên vi phạm quy tắc bắt buộc theo loại, hoặc null nếu hợp lệ. */
export function shapeError(shape: CredentialShape): string | null {
  if (shape.type === CredentialType.OTHER && !shape.label)
    return 'Loại "Khác" bắt buộc nhập tên tài khoản';
  if (isToken(shape.type)) {
    if (!shape.provider) return 'Vui lòng chọn nhà cung cấp chữ ký số';
    if (!shape.serialNumber) return 'Vui lòng nhập số serial token';
    if (!shape.expiresAt) return 'Vui lòng nhập hạn chứng thư số';
    return null;
  }
  if (!shape.username) return 'Vui lòng nhập tên đăng nhập';
  if (!shape.hasSecret) return 'Vui lòng nhập mật khẩu';
  return null;
}

/** L4: hạn trả từ hôm nay đến tối đa 30 ngày. */
export function loanDueError(due: Date, today: Date): string | null {
  if (due < today) return 'Hạn trả không được trước hôm nay';
  if (due.getTime() > today.getTime() + MAX_LOAN_DAYS * DAY_MS)
    return `Hạn trả tối đa ${MAX_LOAN_DAYS} ngày`;
  return null;
}

/**
 * Sự kiện khi người có quyền `update` đặt nơi giữ (L4): nhận từ khách, trả khách, thu hồi token đang
 * mượn về văn phòng, hoặc đổi vị trí cất. Trả khách khi đã ở chỗ khách → lỗi.
 */
export function custodyEvent(
  from: TokenCustody | null,
  to: SettableCustody,
): { event: CredentialEventType } | { error: string } {
  if (to === TokenCustody.CUSTOMER)
    return from === TokenCustody.CUSTOMER
      ? { error: 'Token đang do khách hàng giữ' }
      : { event: CredentialEventType.RETURNED_TO_CUSTOMER };
  if (from === TokenCustody.CUSTOMER)
    return { event: CredentialEventType.RECEIVED_FROM_CUSTOMER };
  if (from === TokenCustody.LOANED)
    return { event: CredentialEventType.RETURNED };
  return { event: CredentialEventType.LOCATION_CHANGED };
}

/** Tên các trường không bí mật đã đổi (sự kiện UPDATED — L5 không ghi giá trị). */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  return Object.keys(after).filter((key) => {
    const a = before[key];
    const b = after[key];
    if (a instanceof Date || b instanceof Date)
      return (
        (a instanceof Date ? a.getTime() : a) !==
        (b instanceof Date ? b.getTime() : b)
      );
    return (a ?? null) !== (b ?? null);
  });
}

/** Số ngày đến hạn (âm khi đã quá). */
export function daysUntil(date: Date | null, today: Date): number | null {
  return date ? Math.round((date.getTime() - today.getTime()) / DAY_MS) : null;
}
