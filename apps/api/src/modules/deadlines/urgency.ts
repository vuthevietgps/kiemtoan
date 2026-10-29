import { Prisma } from '@prisma/client';

/**
 * Mức gấp tự động (đặc tả 06, I11; bảng mốc PL1 IV.2): tính từ số ngày lịch còn lại tới hạn hiện
 * hành theo giờ VN. Không ghi đè mức ưu tiên do người quản lý đặt (H10). Ngày nghiệp vụ 00:00 UTC.
 */

/** Ngưỡng mặc định: Sắp đến hạn ≤ 7, Cần ưu tiên ≤ 3, Gần đến hạn ≤ 1 ngày. */
export const DEFAULT_THRESHOLDS = [7, 3, 1];

export const URGENCIES = [
  'OVERDUE',
  'TODAY',
  'NEAR',
  'PRIORITY',
  'DUE_SOON',
  'NORMAL',
] as const;
export type Urgency = (typeof URGENCIES)[number];

const DAY_MS = 86_400_000;

/** Số ngày lịch từ hôm nay tới hạn (âm = đã quá). */
export function daysUntil(due: Date, today: Date): number {
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
}

export function urgencyOf(
  due: Date,
  today: Date,
  thresholds: number[] = DEFAULT_THRESHOLDS,
): Urgency {
  const days = daysUntil(due, today);
  if (days < 0) return 'OVERDUE';
  if (days === 0) return 'TODAY';
  const [soon, priority, near] = thresholds;
  if (days <= near) return 'NEAR';
  if (days <= priority) return 'PRIORITY';
  if (days <= soon) return 'DUE_SOON';
  return 'NORMAL';
}

/** Thứ tự sắp xếp: gấp nhất trước. */
export function urgencyRank(urgency: Urgency | null): number {
  return urgency ? URGENCIES.indexOf(urgency) : URGENCIES.length;
}

/** Ngưỡng hợp lệ: đúng 3 số nguyên giảm dần, từ 1 đến 90 ngày. */
export function thresholdsError(thresholds: unknown): string | null {
  if (
    !Array.isArray(thresholds) ||
    thresholds.length !== 3 ||
    thresholds.some((t) => !Number.isInteger(t) || t < 1 || t > 90)
  )
    return 'Ngưỡng mức gấp gồm 3 số ngày nguyên từ 1 đến 90';
  const [a, b, c] = thresholds as number[];
  if (!(a > b && b > c))
    return 'Ngưỡng phải giảm dần (Sắp đến hạn > Cần ưu tiên > Gần đến hạn)';
  return null;
}

export interface UrgencyConfig {
  global: number[];
  byService: Map<string, number[]>;
}

export function thresholdsFor(
  config: UrgencyConfig,
  serviceTypeId: string | null | undefined,
): number[] {
  return (
    (serviceTypeId && config.byService.get(serviceTypeId)) || config.global
  );
}

export async function loadUrgencyConfig(
  db: Pick<
    Prisma.TransactionClient,
    'reminderSetting' | 'serviceUrgencyThreshold'
  >,
): Promise<UrgencyConfig> {
  const [setting, services] = await Promise.all([
    db.reminderSetting.findUnique({ where: { id: 1 } }),
    db.serviceUrgencyThreshold.findMany(),
  ]);
  return {
    global: setting?.thresholds ?? DEFAULT_THRESHOLDS,
    byService: new Map(services.map((s) => [s.serviceTypeId, s.thresholds])),
  };
}
