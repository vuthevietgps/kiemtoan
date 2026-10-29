import { BadRequestException } from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

/**
 * Khoảng ngày nghiệp vụ, hai đầu đều tính (inclusive).
 * Ngày lưu dạng Date lúc 00:00 UTC — giống cột kiểu `date` mà Prisma trả về.
 */
export interface Period {
  from: Date;
  to: Date;
}

/** Hợp đồng không tính vào doanh thu: nháp, chờ duyệt, đã huỷ. */
export const NON_REVENUE_STATUSES: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.PENDING_APPROVAL,
  ContractStatus.CANCELLED,
];

export function toBusinessDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function formatBusinessDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Ngày (theo giờ Việt Nam) của một thời điểm, quy về 00:00 UTC để so với cột `date`. */
export function vnDateOf(moment: Date): Date {
  const shifted = new Date(moment.getTime() + VN_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

export function todayVn(now: Date = new Date()): Date {
  return vnDateOf(now);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Số ngày từ `from` đến `to` (âm nếu `to` đã qua). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function currentMonth(now: Date = new Date()): Period {
  const today = todayVn(now);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  return {
    from: new Date(Date.UTC(y, m, 1)),
    to: new Date(Date.UTC(y, m + 1, 0)),
  };
}

export function currentYear(now: Date = new Date()): Period {
  const y = todayVn(now).getUTCFullYear();
  return {
    from: new Date(Date.UTC(y, 0, 1)),
    to: new Date(Date.UTC(y, 11, 31)),
  };
}

/** Lấy khoảng ngày từ query, thiếu đầu nào thì dùng giá trị mặc định. */
export function resolvePeriod(
  from: string | undefined,
  to: string | undefined,
  fallback: Period,
): Period {
  const period = {
    from: from ? toBusinessDate(from) : fallback.from,
    to: to ? toBusinessDate(to) : fallback.to,
  };
  if (period.from > period.to) {
    throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
  }
  return period;
}

/** Kỳ liền trước có cùng số ngày, ví dụ 01–31/10 → 31/08–30/09. */
export function previousPeriod(period: Period): Period {
  const length = daysBetween(period.from, period.to) + 1;
  const to = addDays(period.from, -1);
  return { from: addDays(to, -(length - 1)), to };
}

/** Khoảng thời điểm (timestamptz) bao trọn các ngày của kỳ theo giờ Việt Nam. */
export function periodMoments(period: Period): { gte: Date; lt: Date } {
  return {
    gte: new Date(period.from.getTime() - VN_OFFSET_MS),
    lt: new Date(addDays(period.to, 1).getTime() - VN_OFFSET_MS),
  };
}

/** % thay đổi so với kỳ trước, làm tròn 1 chữ số. Kỳ trước bằng 0 mà kỳ này có số → null (không so được). */
export function changePercent(
  current: Prisma.Decimal,
  previous: Prisma.Decimal,
): number | null {
  if (previous.isZero()) return current.isZero() ? 0 : null;
  return current
    .minus(previous)
    .div(previous.abs())
    .times(100)
    .toDecimalPlaces(1)
    .toNumber();
}

export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Danh sách tháng 'YYYY-MM' trong kỳ, theo thứ tự tăng dần. */
export function monthsOf(period: Period): string[] {
  const months: string[] = [];
  let y = period.from.getUTCFullYear();
  let m = period.from.getUTCMonth();
  const endKey = monthKey(period.to);
  for (let i = 0; i < 240; i++) {
    const key = monthKey(new Date(Date.UTC(y, m, 1)));
    months.push(key);
    if (key >= endKey) break;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

/** Hoàn thành đúng hạn: ngày hoàn thành (giờ VN) không sau hạn. */
export function isOnTime(completedAt: Date, dueDate: Date): boolean {
  return vnDateOf(completedAt).getTime() <= dueDate.getTime();
}

/** Tỷ lệ % làm tròn 1 chữ số; mẫu số 0 → null. */
export function ratePercent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}
