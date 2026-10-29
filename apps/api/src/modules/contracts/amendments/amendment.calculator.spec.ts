import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  applyLineChanges,
  CurrentInstallment,
  CurrentLine,
  suggestSchedule,
  validateSchedule,
} from './amendment.calculator';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const line = (
  id: string,
  unitPrice: string,
  hasTasks = false,
): CurrentLine => ({
  id,
  serviceTypeId: `type-${id}`,
  name: `Dịch vụ ${id}`,
  description: null,
  period: '2026',
  quantity: 1,
  unitPrice: D(unitPrice),
  assigneeId: null,
  hasTasks,
});
const installment = (
  id: string,
  amount: string,
  paid = '0',
  due = '2026-11-01',
): CurrentInstallment => ({
  id,
  name: `Đợt ${id}`,
  amount: D(amount),
  dueDate: new Date(`${due}T00:00:00Z`),
  paid: D(paid),
});

describe('applyLineChanges', () => {
  const current = [line('a', '1000000', true), line('b', '2000000')];

  it('adds, updates price and removes lines, recomputing totals in Decimal', () => {
    const result = applyLineChanges(
      current,
      [
        { action: 'UPDATE', contractServiceId: 'a', unitPrice: '1500000.50' },
        { action: 'REMOVE', contractServiceId: 'b' },
        {
          action: 'ADD',
          serviceTypeId: 'type-c',
          quantity: 3,
          unitPrice: '333333.33',
        },
      ],
      10,
    );
    expect(result.removed).toEqual(['b']);
    expect(result.lines.map((l) => [l.id, l.amount.toFixed(2)])).toEqual([
      ['a', '1500000.50'],
      [null, '999999.99'],
    ]);
    expect(result.subtotal.toFixed(2)).toBe('2500000.49');
    expect(result.vatAmount.toFixed(2)).toBe('250000.00');
    expect(result.total.toFixed(2)).toBe('2750000.49');
  });

  it('does not remove a line that already has tasks', () => {
    expect(() =>
      applyLineChanges(
        current,
        [{ action: 'REMOVE', contractServiceId: 'a' }],
        10,
      ),
    ).toThrow('Dòng Dịch vụ a đã có công việc nên không bỏ được');
  });

  it('rejects unknown, repeated lines and an empty contract', () => {
    expect(() =>
      applyLineChanges(
        current,
        [{ action: 'UPDATE', contractServiceId: 'x' }],
        10,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      applyLineChanges(
        current,
        [
          { action: 'UPDATE', contractServiceId: 'b', quantity: 2 },
          { action: 'REMOVE', contractServiceId: 'b' },
        ],
        10,
      ),
    ).toThrow('xuất hiện nhiều lần');
    expect(() =>
      applyLineChanges(
        [line('b', '1')],
        [{ action: 'REMOVE', contractServiceId: 'b' }],
        10,
      ),
    ).toThrow('ít nhất một dòng');
  });
});

describe('payment schedule after amendment', () => {
  const due = new Date('2027-01-15T00:00:00Z');

  it('adds one extra installment for an increase', () => {
    const schedule = suggestSchedule(
      [installment('1', '1100000', '1100000')],
      D('3300000'),
      'PL-01',
      due,
    );
    expect(
      schedule.map((i) => [i.id ?? null, i.name, D(i.amount).toFixed(0)]),
    ).toEqual([
      ['1', 'Đợt 1', '1100000'],
      [null, 'Bổ sung theo PL-01', '2200000'],
    ]);
  });

  it('cuts unpaid amounts from the last installments for a decrease', () => {
    const schedule = suggestSchedule(
      [
        installment('1', '1000000', '1000000'),
        installment('2', '1000000', '200000'),
        installment('3', '500000'),
      ],
      D('1700000'),
      'PL-02',
      due,
    );
    expect(schedule.map((i) => [i.id, D(i.amount).toFixed(0)])).toEqual([
      ['1', '1000000'],
      ['2', '700000'],
    ]);
  });

  it('refuses a total below what has been collected', () => {
    expect(() =>
      suggestSchedule(
        [installment('1', '1000000', '800000')],
        D('500000'),
        'PL-03',
        due,
      ),
    ).toThrow('nhỏ hơn số tiền đã thu');
  });

  it('validates kept, dropped and new installments against payments', () => {
    const current = [
      installment('1', '1000000', '600000'),
      installment('2', '500000'),
    ];
    expect(() =>
      validateSchedule(
        current,
        [
          { id: '1', name: 'Đợt 1', amount: '600000', dueDate: '2026-11-01' },
          { name: 'Mới', amount: '400000', dueDate: '2027-01-01' },
        ],
        D('1000000'),
      ),
    ).not.toThrow();
    expect(() =>
      validateSchedule(
        current,
        [{ id: '1', name: 'Đợt 1', amount: '500000', dueDate: '2026-11-01' }],
        D('500000'),
      ),
    ).toThrow('không được nhỏ hơn số đã thu');
    expect(() =>
      validateSchedule(
        current,
        [{ id: '2', name: 'Đợt 2', amount: '1500000', dueDate: '2026-12-01' }],
        D('1500000'),
      ),
    ).toThrow('đã thu tiền nên không bỏ được');
    expect(() =>
      validateSchedule(
        current,
        [
          { id: '1', name: 'Đợt 1', amount: '1000000', dueDate: '2026-11-01' },
          { id: '2', name: 'Đợt 2', amount: '499999', dueDate: '2026-12-01' },
        ],
        D('1500000'),
      ),
    ).toThrow('Tổng các đợt thanh toán');
  });
});

describe('applyLineChanges with audit engagements (04-F)', () => {
  it('does not remove a line that already has an audit engagement', () => {
    expect(() =>
      applyLineChanges(
        [{ ...line('b', '2000000'), hasAudit: true }],
        [{ action: 'REMOVE', contractServiceId: 'b' }],
        10,
      ),
    ).toThrow('Dòng Dịch vụ b đã có hồ sơ kiểm toán nên không bỏ được');
  });
});
