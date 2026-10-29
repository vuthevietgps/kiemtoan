import { Prisma, TaskStatus } from '@prisma/client';
import { toCsv } from './csv.util';
import { toBusinessDate } from './period.util';
import {
  groupRevenue,
  RevenueContract,
  summarizeCompliance,
} from './report-grouping.util';

const d = toBusinessDate;
const dec = (v: number) => new Prisma.Decimal(v);
const period = { from: d('2026-01-01'), to: d('2026-03-31') };

const accounting = { id: 'st1', name: 'Kế toán' };
const tax = { id: 'st2', name: 'Thuế' };

const contracts: RevenueContract[] = [
  {
    id: 'c1',
    startDate: d('2026-01-10'),
    subtotal: dec(300),
    total: dec(330),
    vatRate: dec(10),
    customer: { id: 'k1', name: 'Công ty A' },
    owner: { id: 'u1', fullName: 'An' },
    services: [
      { amount: dec(200), serviceType: accounting },
      { amount: dec(100), serviceType: tax },
    ],
  },
  {
    id: 'c2',
    startDate: d('2026-03-05'),
    subtotal: dec(500),
    total: dec(550),
    vatRate: dec(10),
    customer: { id: 'k1', name: 'Công ty A' },
    owner: null,
    services: [{ amount: dec(500), serviceType: accounting }],
  },
];

describe('groupRevenue', () => {
  it('theo loại dịch vụ: cộng thành tiền dòng dịch vụ, đếm hợp đồng', () => {
    const rows = groupRevenue(contracts, 'serviceType', period);
    expect(
      rows.map((r) => [
        r.name,
        r.contracts,
        r.subtotal.toNumber(),
        r.total.toNumber(),
      ]),
    ).toEqual([
      ['Kế toán', 2, 700, 770],
      ['Thuế', 1, 100, 110],
    ]);
  });

  it('theo khách hàng và người phụ trách', () => {
    const byCustomer = groupRevenue(contracts, 'customer', period);
    expect(byCustomer).toHaveLength(1);
    expect(byCustomer[0].subtotal.toNumber()).toBe(800);
    const byOwner = groupRevenue(contracts, 'owner', period);
    expect(byOwner.map((r) => r.name)).toEqual(['Chưa phân công', 'An']);
  });

  it('theo tháng: đủ mọi tháng trong kỳ, tháng trống = 0', () => {
    const rows = groupRevenue(contracts, 'month', period);
    expect(rows.map((r) => [r.key, r.subtotal.toNumber()])).toEqual([
      ['2026-01', 300],
      ['2026-02', 0],
      ['2026-03', 500],
    ]);
  });
});

describe('summarizeCompliance', () => {
  const an = { id: 'u1', fullName: 'An' };
  const binh = { id: 'u2', fullName: 'Bình' };
  const tasks = [
    {
      dueDate: d('2026-01-20'),
      status: TaskStatus.COMPLETED,
      completedAt: new Date('2026-01-19T03:00:00Z'),
      assignee: an,
    },
    {
      dueDate: d('2026-01-20'),
      status: TaskStatus.COMPLETED,
      completedAt: new Date('2026-01-22T03:00:00Z'),
      assignee: an,
    },
    {
      dueDate: d('2026-02-10'),
      status: TaskStatus.COMPLETED,
      completedAt: new Date('2026-02-10T10:00:00Z'),
      assignee: binh,
    },
    {
      dueDate: d('2026-02-15'),
      status: TaskStatus.IN_PROGRESS,
      completedAt: null,
      assignee: binh,
    },
    {
      dueDate: d('2026-03-25'),
      status: TaskStatus.NOT_STARTED,
      completedAt: null,
      assignee: binh,
    },
  ];
  const result = summarizeCompliance(tasks, period, d('2026-03-01'));

  it('đếm đúng hạn / trễ hạn / quá hạn chưa xong theo tháng', () => {
    expect(result.byMonth).toEqual([
      { month: '2026-01', onTime: 1, late: 1, overdueOpen: 0, onTimeRate: 50 },
      { month: '2026-02', onTime: 1, late: 0, overdueOpen: 1, onTimeRate: 100 },
      {
        month: '2026-03',
        onTime: 0,
        late: 0,
        overdueOpen: 0,
        onTimeRate: null,
      },
    ]);
  });

  it('theo nhân viên và tổng', () => {
    expect(
      result.byStaff.map((s) => [s.name, s.onTime, s.late, s.overdueOpen]),
    ).toEqual([
      ['An', 1, 1, 0],
      ['Bình', 1, 0, 1],
    ]);
    expect(result.totals.onTimeRate).toBeCloseTo(66.7);
  });
});

describe('toCsv', () => {
  it('có BOM, escape dấu phẩy và ngoặc kép', () => {
    const csv = toCsv(['Tên', 'Tiền'], [['Công ty "A", HN', dec(1000)]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Công ty ""A"", HN",1000');
  });
});
