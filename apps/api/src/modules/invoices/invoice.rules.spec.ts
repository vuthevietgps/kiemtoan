import { InvoiceStatus } from '@prisma/client';
import {
  heldSubtotal,
  invoicedTotal,
  normalizeIdentity,
  reconcile,
  splitTotal,
} from './invoice.rules';

const inv = (status: InvoiceStatus, subtotal: string, total = subtotal) => ({
  status,
  subtotal,
  total,
});

describe('luật sổ hoá đơn (08)', () => {
  it('K3: đề nghị theo đợt — tổng đúng bằng tổng đợt, trước VAT làm tròn đồng, VAT là phần còn lại', () => {
    const r = splitTotal('9900000', 10);
    expect([r.subtotal, r.vatAmount, r.total].map(String)).toEqual([
      '9000000',
      '900000',
      '9900000',
    ]);
    const odd = splitTotal('1000001', 8);
    expect(odd.subtotal.add(odd.vatAmount).toString()).toBe('1000001');
    expect(odd.subtotal.toString()).toBe('925927');
  });

  it('K2: phần giá trị bị giữ gồm chờ xuất + đã xuất + đã điều chỉnh (kể cả điều chỉnh âm); bỏ bị thay thế, huỷ', () => {
    expect(
      heldSubtotal([
        inv('REQUESTED', '100'),
        inv('ISSUED', '200'),
        inv('ADJUSTED', '300'),
        inv('ISSUED', '-50'),
        inv('REPLACED', '999'),
        inv('CANCELLED', '999'),
      ]).toString(),
    ).toBe('550');
  });

  it('K8: đã xuất = hoá đơn hiệu lực gồm VAT; đối chiếu đã thu chưa xuất / đã xuất chưa thu', () => {
    const invoiced = invoicedTotal([
      inv('ISSUED', '1000', '1100'),
      inv('ADJUSTED', '2000', '2200'),
      inv('ISSUED', '-500', '-550'),
      inv('REQUESTED', '700', '770'),
      inv('REPLACED', '900', '990'),
    ]);
    expect(invoiced.toString()).toBe('2750');
    const a = reconcile('3000', invoiced);
    expect([
      a.paidNotInvoiced.toString(),
      a.invoicedNotPaid.toString(),
    ]).toEqual(['250', '0']);
    const b = reconcile('1000', invoiced);
    expect([
      b.paidNotInvoiced.toString(),
      b.invoicedNotPaid.toString(),
    ]).toEqual(['0', '1750']);
  });

  it('K5: chuẩn hoá mẫu số / ký hiệu / số để chặn trùng', () => {
    expect(
      normalizeIdentity({
        templateCode: ' 1 ',
        symbol: ' c25taa',
        number: ' 0000123 ',
      }),
    ).toEqual({ templateCode: '1', symbol: 'C25TAA', number: '0000123' });
  });
});
