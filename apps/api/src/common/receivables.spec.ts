import { Prisma } from '@prisma/client';
import {
  addAging,
  AGING_KEYS,
  agingBucket,
  agingOf,
  allocateContract,
  allocatedByInstallment,
  emptyAging,
  installmentStates,
  reportMilestone,
  summarizeReceivable,
  upcomingAmount,
  type AllocInstallment,
  type AllocPayment,
} from './receivables';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const str = (m: Map<string, Prisma.Decimal>) =>
  Object.fromEntries([...m].map(([k, v]) => [k, v.toString()]));

/** Công nợ HĐ từ phiếu (theo thứ tự) — phân bổ rồi tổng hợp như dữ liệu đã lưu. */
function summarize(
  total: string,
  installments: AllocInstallment[],
  payments: AllocPayment[],
  today: Date,
) {
  const allocated = allocatedByInstallment(
    allocateContract(installments, payments),
  );
  const paid = payments.reduce(
    (acc, p) => acc.add(new Prisma.Decimal(p.amount)),
    new Prisma.Decimal(0),
  );
  return summarizeReceivable(
    total,
    installments.map((i) => ({
      ...i,
      allocated: allocated.get(i.id) ?? 0,
    })),
    paid,
    today,
  );
}

describe('allocateContract (07, J4)', () => {
  // Chuyển từ contract-calculator.spec (allocatePayments) — cùng dữ liệu, cùng kết quả.
  it('phân bổ phiếu thu: gắn đợt trước, phần dư theo hạn sớm nhất', () => {
    const inst = [
      { id: 'b', amount: '50', dueDate: new Date('2025-02-01') },
      { id: 'a', amount: '50', dueDate: new Date('2025-01-01') },
    ];
    const r = allocatedByInstallment(
      allocateContract(inst, [
        { id: 'p1', amount: '60', installmentId: 'b' },
        { id: 'p2', amount: '20', installmentId: null },
      ]),
    );
    expect(r.get('b')!.toString()).toBe('50');
    expect(r.get('a')!.toString()).toBe('30');
  });

  it('R1: phiếu chỉ định đợt chưa đến hạn không trừ vào đợt đã quá hạn', () => {
    const inst = [
      { id: 'A', amount: '1000000', dueDate: d('2026-01-31') },
      { id: 'B', amount: '1000000', dueDate: d('2099-12-31') },
    ];
    const pays = [{ id: 'p', amount: '1000000', installmentId: 'B' }];
    expect(str(allocatedByInstallment(allocateContract(inst, pays)))).toEqual({
      B: '1000000',
    });
    expect(
      summarize(
        '2000000',
        inst,
        pays,
        d('2026-10-28'),
      ).overdueAmount.toString(),
    ).toBe('1000000');
  });

  it('lưu theo từng phiếu; đợt đã đủ thì phiếu chỉ định sau chuyển sang đợt hạn sớm nhất còn thiếu; tiền thừa không gắn đợt', () => {
    const inst = [
      { id: 'A', amount: '100', dueDate: d('2026-01-01'), sortOrder: 1 },
      { id: 'B', amount: '100', dueDate: d('2026-02-01'), sortOrder: 2 },
      { id: 'C', amount: '100', dueDate: d('2026-02-01'), sortOrder: 3 },
    ];
    const allocs = allocateContract(inst, [
      { id: 'p1', amount: '150', installmentId: null },
      { id: 'p2', amount: '80', installmentId: 'A' },
      { id: 'p3', amount: '200', installmentId: 'C' },
    ]);
    expect(
      allocs.map(
        (a) => `${a.paymentId}>${a.installmentId}:${a.amount.toString()}`,
      ),
    ).toEqual(['p1>A:100', 'p1>B:50', 'p2>B:50', 'p2>C:30', 'p3>C:70']);
    // Hai đợt cùng hạn: theo thứ tự đợt (B trước C); 130 của p3 không còn đợt nào → không gắn.
  });
});

describe('summarizeReceivable (07, J12)', () => {
  it('nhóm tuổi nợ 0–30, 31–60, 61–90, >90', () => {
    expect(agingBucket(0)).toBe('0-30');
    expect(agingBucket(30)).toBe('0-30');
    expect(agingBucket(31)).toBe('31-60');
    expect(agingBucket(61)).toBe('61-90');
    expect(agingBucket(91)).toBe('>90');
  });

  // Chuyển từ payments/receivables.util.spec — cùng dữ liệu, cùng kỳ vọng.
  const installments = [
    { id: 'i1', amount: '100', dueDate: new Date('2025-01-01') },
    { id: 'i2', amount: '100', dueDate: new Date('2025-03-01') },
    { id: 'i3', amount: '100', dueDate: new Date('2025-12-01') },
  ];

  it('tính số quá hạn và tuổi nợ của đợt quá hạn lâu nhất chưa thu đủ', () => {
    const r = summarize(
      '300',
      installments,
      [{ id: 'p', amount: '120', installmentId: null }],
      new Date('2025-04-15T10:00:00Z'),
    );
    expect(r.paid.toString()).toBe('120');
    expect(r.remaining.toString()).toBe('180');
    // Đợt 1 đã đủ, đợt 2 còn 80 quá hạn từ 01/03 → 45 ngày.
    expect(r.overdueAmount.toString()).toBe('80');
    expect(r.overdueDays).toBe(45);
    expect(r.ageBucket).toBe('31-60');
  });

  it('chưa có đợt nào quá hạn thì không có tuổi nợ', () => {
    const r = summarize('300', installments, [], new Date('2024-12-01'));
    expect(r.overdueAmount.toString()).toBe('0');
    expect(r.ageBucket).toBeNull();
  });

  // Chuyển từ reports/report-grouping.util.spec (overdueAmount) — phiếu không chỉ định đợt.
  describe('quá hạn với phiếu không chỉ định đợt', () => {
    const inst = [
      { id: 'a', amount: '100', dueDate: d('2026-01-31') },
      { id: 'b', amount: '200', dueDate: d('2026-02-28') },
      { id: 'c', amount: '300', dueDate: d('2026-03-31') },
    ];
    const overdue = (paid: string, today: string) =>
      summarize(
        '600',
        inst,
        paid === '0' ? [] : [{ id: 'p', amount: paid, installmentId: null }],
        d(today),
      ).overdueAmount.toNumber();
    it('tổng các đợt đã tới hạn trừ số đã thu', () => {
      expect(overdue('50', '2026-03-01')).toBe(250);
    });
    it('thu đủ hoặc dư thì không quá hạn', () => {
      expect(overdue('400', '2026-03-01')).toBe(0);
    });
    it('đợt tới hạn đúng hôm nay chưa tính quá hạn', () => {
      expect(overdue('0', '2026-01-31')).toBe(0);
    });
  });
});

describe('tuổi nợ theo từng đợt (07-D1, J12)', () => {
  const today = d('2026-06-30');
  const balances = [
    { id: 'q1', amount: '100', dueDate: d('2026-01-31'), allocated: '100' }, // đã thu đủ
    { id: 'q2', amount: '200', dueDate: d('2026-03-15'), allocated: '50' }, // quá 107 ngày
    { id: 'q3', amount: '300', dueDate: d('2026-05-20'), allocated: '0' }, // quá 41 ngày
    { id: 'q4', amount: '400', dueDate: d('2026-06-29'), allocated: '0' }, // quá 1 ngày
    { id: 'q5', amount: '500', dueDate: d('2026-06-30'), allocated: '0' }, // đến hạn hôm nay
    { id: 'q6', amount: '600', dueDate: d('2026-07-07'), allocated: '0' }, // còn 7 ngày
    { id: 'q7', amount: '700', dueDate: d('2026-07-08'), allocated: '0' }, // còn 8 ngày
  ];
  const states = installmentStates(balances, today);
  const byId = Object.fromEntries(states.map((s) => [s.id, s]));

  it('mỗi đợt: còn thiếu, số ngày quá hạn, nhóm tuổi; đợt thu đủ hoặc chưa tới hạn không quá hạn', () => {
    expect(byId.q1).toMatchObject({ overdueDays: null, bucket: null });
    expect(byId.q1.remaining.toString()).toBe('0');
    expect(byId.q2).toMatchObject({ overdueDays: 107, bucket: '>90' });
    expect(byId.q2.remaining.toString()).toBe('150');
    expect(byId.q3).toMatchObject({ overdueDays: 41, bucket: '31-60' });
    expect(byId.q4).toMatchObject({ overdueDays: 1, bucket: '0-30' });
    expect(byId.q5).toMatchObject({ dueInDays: 0, overdueDays: null });
    expect(byId.q6.dueInDays).toBe(7);
  });

  it('tổng theo nhóm tuổi chia theo đợt; chưa đến hạn = còn phải thu − quá hạn; tổng bằng còn phải thu', () => {
    // Còn phải thu 2.700 = 150 + 300 + 400 + 500 + 600 + 700 + 50 chưa gắn đợt.
    const aging = agingOf('2700', states);
    expect(
      Object.fromEntries(AGING_KEYS.map((k) => [k, aging[k].toString()])),
    ).toEqual({
      notDue: '1850',
      '0-30': '400',
      '31-60': '300',
      '61-90': '0',
      '>90': '150',
    });
    const sum = AGING_KEYS.reduce(
      (acc, k) => acc.add(aging[k]),
      new Prisma.Decimal(0),
    );
    expect(sum.toString()).toBe('2700');
  });

  it('sắp đến hạn 7 ngày gồm đợt đến hạn hôm nay, không gồm đợt quá hạn hoặc ngày thứ 8', () => {
    expect(upcomingAmount(states).toString()).toBe('1100');
  });

  it('summarizeReceivable giữ kết quả cũ: quá hạn và tuổi của đợt lâu nhất', () => {
    const r = summarizeReceivable('2850', balances, '150', today);
    expect(r.overdueAmount.toString()).toBe('850');
    expect(r).toMatchObject({ overdueDays: 107, ageBucket: '>90' });
  });

  it('cộng tuổi nợ nhiều HĐ', () => {
    const total = addAging(agingOf('2700', states), agingOf('10', []));
    expect(total.notDue.toString()).toBe('1860');
    expect(emptyAging()['>90'].toString()).toBe('0');
  });
});

describe('đợt theo mốc phát hành BCKT (07-D2, J10)', () => {
  it('mốc = ngày phát hành muộn nhất khi mọi dòng BCKT đã phát hành; thiếu dòng nào thì chưa có mốc', () => {
    expect(reportMilestone([])).toBeNull();
    expect(
      reportMilestone([
        { issued: true, reportDate: d('2026-03-10') },
        { issued: false, reportDate: null },
      ]),
    ).toBeNull();
    expect(
      reportMilestone([
        { issued: true, reportDate: d('2026-03-10') },
        { issued: true, reportDate: d('2026-04-02') },
      ]),
    ).toEqual(d('2026-04-02'));
  });

  it('đợt chờ mốc: không quá hạn dù ngày dự kiến đã qua, không sắp đến hạn, tính vào Chưa đến hạn', () => {
    const states = installmentStates(
      [
        {
          id: 'w',
          amount: '500',
          dueDate: d('2026-01-31'),
          allocated: '0',
          awaitingMilestone: true,
        },
        { id: 'f', amount: '300', dueDate: d('2026-06-01'), allocated: '0' },
      ],
      d('2026-06-30'),
    );
    expect(states[0]).toMatchObject({
      dueInDays: null,
      overdueDays: null,
      bucket: null,
    });
    expect(states[1]).toMatchObject({ overdueDays: 29, bucket: '0-30' });
    expect(upcomingAmount(states).toString()).toBe('0');
    const aging = agingOf('800', states);
    expect(aging.notDue.toString()).toBe('500');
    expect(aging['0-30'].toString()).toBe('300');
  });
});
