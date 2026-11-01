import { Prisma } from '@prisma/client';
import {
  change,
  Entry,
  monthKey,
  revenueRows,
  revenueTotals,
  sameRangeLastYear,
} from './revenue-measures';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const dec = (n: number) => new Prisma.Decimal(n);
const e = (key: string, amount: number, contractId = 'c1'): Entry => ({
  key,
  name: key === 'k1' ? 'Công ty A' : key === 'k2' ? 'Công ty B' : key,
  amount: dec(amount),
  contractId,
});
const none = { contractValue: [], invoiced: [], paid: [] };

describe('revenue-measures (10-D, M4–M5)', () => {
  it('cùng kỳ năm trước; 29/02 → 28/02', () => {
    expect(
      sameRangeLastYear({ from: d('2026-01-01'), to: d('2026-12-31') }),
    ).toEqual({
      from: d('2025-01-01'),
      to: d('2025-12-31'),
    });
    expect(
      sameRangeLastYear({ from: d('2028-02-29'), to: d('2028-02-29') }).to,
    ).toEqual(d('2027-02-28'));
    expect(monthKey(d('2025-03-15'), 1)).toBe('2026-03');
  });

  it('% thay đổi 1 chữ số; kỳ so sánh 0 hoặc không có → null', () => {
    expect(change(dec(150), dec(100))).toBe(50);
    expect(change(dec(1), dec(3))).toBe(-66.7);
    expect(change(dec(5), dec(0))).toBeNull();
    expect(change(null, dec(5))).toBeNull();
  });

  it('3 thước đo không trộn; nhóm chỉ có ở năm trước vẫn hiện; tổng đếm HĐ duyệt', () => {
    const current = {
      contractValue: [e('k1', 1000, 'c1'), e('k1', 500, 'c2')],
      invoiced: [e('k1', 800), e('k1', -100)],
      paid: [e('k1', 330)],
    };
    const previous = {
      ...none,
      contractValue: [e('k1', 750), e('k2', 400, 'c9')],
    };
    const rows = revenueRows(current, previous, 'customer');
    expect(
      rows.map((r) => [
        r.name,
        r.contracts,
        Number(r.contractValue),
        Number(r.invoiced),
        Number(r.paid),
      ]),
    ).toEqual([
      ['Công ty A', 2, 1500, 700, 330],
      ['Công ty B', 0, 0, 0, 0],
    ]);
    expect(rows[0].change).toEqual({
      contractValue: 100,
      invoiced: null,
      paid: null,
    });
    const totals = revenueTotals(current, previous);
    expect([
      totals.contracts,
      Number(totals.contractValue),
      totals.change.contractValue,
    ]).toEqual([2, 1500, 30.4]);
  });

  it('theo loại dịch vụ: đã xuất / đã thu không chia được theo dịch vụ → null', () => {
    const rows = revenueRows(
      { contractValue: [e('st1', 600)], invoiced: [e('k1', 660)], paid: [] },
      none,
      'serviceType',
    );
    expect(rows.map((r) => r.key)).toEqual(['st1']);
    const service = rows.find((r) => r.key === 'st1')!;
    expect(service.invoiced).toBeNull();
    expect(service.paid).toBeNull();
  });
});
