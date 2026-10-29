import { PricingBasis, Prisma } from '@prisma/client';

/**
 * Logic thuần của bảng giá dịch vụ (đặc tả 03-A). Bậc giá là khoảng nửa mở
 * [minValue, maxValue); maxValue null = không giới hạn, chỉ cho bậc cuối.
 */

const { Decimal } = Prisma;
type DecimalLike = Prisma.Decimal | string;

export interface TierInput {
  minValue: DecimalLike;
  maxValue?: DecimalLike | null;
}

export interface TierLike {
  id: string;
  minValue: DecimalLike;
  maxValue: DecimalLike | null;
  unitPrice: DecimalLike;
}

export interface PriceListLike<T extends TierLike = TierLike> {
  id: string;
  effectiveFrom: Date;
  pricingBasis: PricingBasis;
  pricingUnit: string | null;
  tiers: T[];
}

export type PriceListStatus = 'UPCOMING' | 'ACTIVE' | 'EXPIRED';

export type QuoteFallbackReason = 'NO_PRICE_LIST' | 'NO_TIER';

export interface PriceQuote {
  unitPrice: Prisma.Decimal;
  fallback: boolean;
  reason: QuoteFallbackReason | null;
  priceListId: string | null;
  tierId: string | null;
  pricingBasis: PricingBasis | null;
  pricingUnit: string | null;
}

/** Trả về thông báo lỗi tiếng Việt nếu các bậc không hợp lệ, null nếu hợp lệ. */
export function tierError(
  basis: PricingBasis,
  tiers: TierInput[],
): string | null {
  if (tiers.length === 0) return 'Bảng giá cần ít nhất một bậc';
  if (basis === PricingBasis.NONE) {
    const [only] = tiers;
    const flat =
      tiers.length === 1 &&
      new Decimal(only.minValue).isZero() &&
      only.maxValue == null;
    return flat
      ? null
      : 'Dịch vụ không tính giá theo bậc chỉ có một mức giá, áp dụng từ 0 và không giới hạn';
  }
  for (let i = 0; i < tiers.length; i++) {
    const label = `Bậc ${i + 1}`;
    const min = new Decimal(tiers[i].minValue);
    const rawMax = tiers[i].maxValue;
    if (rawMax == null) {
      if (i < tiers.length - 1)
        return `${label}: chỉ bậc cuối được để trống giá trị "đến"`;
    } else if (new Decimal(rawMax).lte(min)) {
      return `${label}: giá trị "đến" phải lớn hơn giá trị "từ"`;
    }
    // Bậc trước chắc chắn có cận trên vì chỉ bậc cuối được để trống.
    const previousMax = i > 0 ? tiers[i - 1].maxValue : null;
    if (previousMax != null && !min.eq(previousMax)) {
      return `${label}: phải bắt đầu đúng tại giá trị "đến" của bậc ${i} (không chồng lấn, không bỏ trống)`;
    }
  }
  return null;
}

/** Bảng giá áp dụng tại ngày `date`: ngày hiệu lực gần nhất không sau `date`. */
export function pickPriceList<T extends { effectiveFrom: Date }>(
  lists: T[],
  date: Date,
): T | undefined {
  let picked: T | undefined;
  for (const list of lists) {
    if (list.effectiveFrom.getTime() > date.getTime()) continue;
    if (!picked || list.effectiveFrom > picked.effectiveFrom) picked = list;
  }
  return picked;
}

/** Bậc chứa giá trị `value`, hoặc undefined nếu nằm ngoài mọi bậc. */
export function pickTier<T extends TierLike>(
  tiers: T[],
  value: Prisma.Decimal,
): T | undefined {
  return tiers.find(
    (t) =>
      value.gte(t.minValue) && (t.maxValue === null || value.lt(t.maxValue)),
  );
}

/** Trạng thái từng bảng giá tại `today`: sắp áp dụng, đang áp dụng hoặc đã thay thế. */
export function priceListStatuses(
  lists: { id: string; effectiveFrom: Date }[],
  today: Date,
): Map<string, PriceListStatus> {
  const active = pickPriceList(lists, today);
  return new Map(
    lists.map((list) => [
      list.id,
      list.effectiveFrom > today
        ? 'UPCOMING'
        : list.id === active?.id
          ? 'ACTIVE'
          : 'EXPIRED',
    ]),
  );
}

/**
 * Báo giá tại ngày `date`. Không có bảng giá hoặc giá trị nằm ngoài các bậc thì dùng giá chuẩn
 * của dịch vụ và đánh dấu `fallback`. Gọi khi đã kiểm tra `value` có mặt nếu bảng giá theo bậc.
 */
export function quotePrice(
  defaultPrice: DecimalLike,
  list: PriceListLike | undefined,
  value: Prisma.Decimal,
): PriceQuote {
  const fallback = (reason: QuoteFallbackReason): PriceQuote => ({
    unitPrice: new Decimal(defaultPrice),
    fallback: true,
    reason,
    priceListId: list?.id ?? null,
    tierId: null,
    pricingBasis: list?.pricingBasis ?? null,
    pricingUnit: list?.pricingUnit ?? null,
  });
  if (!list) return fallback('NO_PRICE_LIST');
  const tier = pickTier(list.tiers, value);
  if (!tier) return fallback('NO_TIER');
  return {
    unitPrice: new Decimal(tier.unitPrice),
    fallback: false,
    reason: null,
    priceListId: list.id,
    tierId: tier.id,
    pricingBasis: list.pricingBasis,
    pricingUnit: list.pricingUnit,
  };
}
