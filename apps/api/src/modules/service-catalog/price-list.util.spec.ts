import { PricingBasis, Prisma } from '@prisma/client';
import {
  pickPriceList,
  pickTier,
  priceListStatuses,
  quotePrice,
  tierError,
} from './price-list.util';

const dec = (v: string | number) => new Prisma.Decimal(v);
const day = (v: string) => new Date(`${v}T00:00:00.000Z`);

const TIERS = [
  { id: 't1', minValue: '0', maxValue: '100', unitPrice: '1000000' },
  { id: 't2', minValue: '100', maxValue: '300', unitPrice: '2000000' },
  { id: 't3', minValue: '300', maxValue: null, unitPrice: '3000000' },
];

describe('tierError', () => {
  const basis = PricingBasis.DOCUMENT_COUNT;

  it('chấp nhận các bậc liền mạch, bậc cuối không giới hạn', () => {
    expect(tierError(basis, TIERS)).toBeNull();
  });

  it('báo lỗi khi có khoảng trống giữa hai bậc', () => {
    expect(
      tierError(basis, [
        { minValue: '0', maxValue: '100' },
        { minValue: '150', maxValue: null },
      ]),
    ).toBe(
      'Bậc 2: phải bắt đầu đúng tại giá trị "đến" của bậc 1 (không chồng lấn, không bỏ trống)',
    );
  });

  it('báo lỗi khi hai bậc chồng lấn', () => {
    expect(
      tierError(basis, [
        { minValue: '0', maxValue: '100' },
        { minValue: '80', maxValue: '200' },
      ]),
    ).toMatch(/^Bậc 2: phải bắt đầu đúng/);
  });

  it('báo lỗi khi giá trị "đến" không lớn hơn "từ"', () => {
    expect(tierError(basis, [{ minValue: '50', maxValue: '50' }])).toBe(
      'Bậc 1: giá trị "đến" phải lớn hơn giá trị "từ"',
    );
  });

  it('chỉ bậc cuối được để trống giá trị "đến"', () => {
    expect(
      tierError(basis, [
        { minValue: '0', maxValue: null },
        { minValue: '100', maxValue: null },
      ]),
    ).toBe('Bậc 1: chỉ bậc cuối được để trống giá trị "đến"');
  });

  it('bảng giá rỗng không hợp lệ', () => {
    expect(tierError(basis, [])).toBe('Bảng giá cần ít nhất một bậc');
  });

  it('dịch vụ không theo bậc chỉ có một mức giá từ 0, không giới hạn', () => {
    expect(
      tierError(PricingBasis.NONE, [{ minValue: '0', maxValue: null }]),
    ).toBeNull();
    expect(tierError(PricingBasis.NONE, TIERS)).toMatch(/một mức giá/);
    expect(
      tierError(PricingBasis.NONE, [{ minValue: '10', maxValue: null }]),
    ).toMatch(/một mức giá/);
  });
});

describe('pickTier', () => {
  it('cận dưới tính vào bậc, cận trên thuộc bậc sau', () => {
    expect(pickTier(TIERS, dec('99.99'))?.id).toBe('t1');
    expect(pickTier(TIERS, dec(100))?.id).toBe('t2');
    expect(pickTier(TIERS, dec('299.99'))?.id).toBe('t2');
    expect(pickTier(TIERS, dec(300))?.id).toBe('t3');
    expect(pickTier(TIERS, dec(1_000_000))?.id).toBe('t3');
  });

  it('không có bậc khi giá trị nằm dưới bậc đầu', () => {
    const tiers = [{ id: 'x', minValue: '10', maxValue: null, unitPrice: '1' }];
    expect(pickTier(tiers, dec(5))).toBeUndefined();
  });
});

describe('pickPriceList / priceListStatuses', () => {
  const lists = [
    { id: 'old', effectiveFrom: day('2026-01-01') },
    { id: 'current', effectiveFrom: day('2026-10-01') },
    { id: 'next', effectiveFrom: day('2026-12-01') },
  ];

  it('chọn bảng có ngày hiệu lực gần nhất không sau ngày cần báo giá', () => {
    expect(pickPriceList(lists, day('2026-10-15'))?.id).toBe('current');
    expect(pickPriceList(lists, day('2026-12-01'))?.id).toBe('next');
    expect(pickPriceList(lists, day('2026-09-30'))?.id).toBe('old');
    expect(pickPriceList(lists, day('2025-12-31'))).toBeUndefined();
  });

  it('đánh dấu sắp áp dụng / đang áp dụng / đã thay thế', () => {
    const statuses = priceListStatuses(lists, day('2026-10-15'));
    expect(Object.fromEntries(statuses)).toEqual({
      old: 'EXPIRED',
      current: 'ACTIVE',
      next: 'UPCOMING',
    });
  });
});

describe('quotePrice', () => {
  const list = {
    id: 'pl1',
    effectiveFrom: day('2026-10-01'),
    pricingBasis: PricingBasis.DOCUMENT_COUNT,
    pricingUnit: 'chứng từ/tháng',
    tiers: TIERS,
  };

  it('lấy đơn giá của bậc phù hợp', () => {
    const quote = quotePrice('500000', list, dec(150));
    expect(quote.unitPrice.toString()).toBe('2000000');
    expect(quote).toMatchObject({
      fallback: false,
      reason: null,
      priceListId: 'pl1',
      tierId: 't2',
      pricingUnit: 'chứng từ/tháng',
    });
  });

  it('không có bảng giá thì dùng giá chuẩn', () => {
    const quote = quotePrice('500000', undefined, dec(150));
    expect(quote.unitPrice.toString()).toBe('500000');
    expect(quote).toMatchObject({
      fallback: true,
      reason: 'NO_PRICE_LIST',
      priceListId: null,
    });
  });

  it('giá trị ngoài các bậc thì dùng giá chuẩn và ghi lý do', () => {
    const narrow = { ...list, tiers: [TIERS[1]] };
    const quote = quotePrice('500000', narrow, dec(10));
    expect(quote.unitPrice.toString()).toBe('500000');
    expect(quote).toMatchObject({
      fallback: true,
      reason: 'NO_TIER',
      priceListId: 'pl1',
      tierId: null,
    });
  });
});
