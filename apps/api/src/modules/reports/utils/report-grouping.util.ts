import { InstallmentDueRule, Prisma, TaskStatus } from '@prisma/client';
import { contractReceivable } from '../../payments/payment-allocation';
import {
  formatBusinessDate,
  isOnTime,
  monthKey,
  monthsOf,
  Period,
  ratePercent,
} from './period.util';

const ZERO = new Prisma.Decimal(0);

export const REVENUE_GROUPS = [
  'serviceType',
  'customer',
  'owner',
  'month',
] as const;
export type RevenueGroupBy = (typeof REVENUE_GROUPS)[number];

export interface RevenueContract {
  id: string;
  startDate: Date;
  subtotal: Prisma.Decimal;
  total: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  customer: { id: string; name: string };
  owner: { id: string; fullName: string } | null;
  services: {
    amount: Prisma.Decimal;
    serviceType: { id: string; name: string };
  }[];
}

export interface RevenueRow {
  key: string;
  name: string;
  contracts: number;
  subtotal: Prisma.Decimal;
  total: Prisma.Decimal;
}

interface Bucket {
  name: string;
  contractIds: Set<string>;
  subtotal: Prisma.Decimal;
  total: Prisma.Decimal;
}

function addTo(
  buckets: Map<string, Bucket>,
  key: string,
  name: string,
  contractId: string,
  subtotal: Prisma.Decimal,
  total: Prisma.Decimal,
): void {
  const bucket = buckets.get(key) ?? {
    name,
    contractIds: new Set<string>(),
    subtotal: ZERO,
    total: ZERO,
  };
  bucket.contractIds.add(contractId);
  bucket.subtotal = bucket.subtotal.plus(subtotal);
  bucket.total = bucket.total.plus(total);
  buckets.set(key, bucket);
}

/**
 * Gom doanh thu hợp đồng theo nhóm.
 * - serviceType: cộng thành tiền từng dòng dịch vụ (trước VAT), tổng thanh toán = thành tiền × (1 + VAT).
 * - customer / owner / month: cộng subtotal và total của hợp đồng (tháng theo ngày bắt đầu).
 */
export function groupRevenue(
  contracts: RevenueContract[],
  groupBy: RevenueGroupBy,
  period: Period,
): RevenueRow[] {
  const buckets = new Map<string, Bucket>();
  if (groupBy === 'month') {
    for (const key of monthsOf(period)) {
      buckets.set(key, {
        name: key,
        contractIds: new Set(),
        subtotal: ZERO,
        total: ZERO,
      });
    }
  }
  for (const c of contracts) {
    if (groupBy === 'serviceType') {
      const vat = c.vatRate.div(100).plus(1);
      for (const s of c.services) {
        const total = s.amount.times(vat).toDecimalPlaces(2);
        addTo(
          buckets,
          s.serviceType.id,
          s.serviceType.name,
          c.id,
          s.amount,
          total,
        );
      }
    } else if (groupBy === 'customer') {
      addTo(buckets, c.customer.id, c.customer.name, c.id, c.subtotal, c.total);
    } else if (groupBy === 'owner') {
      const key = c.owner?.id ?? 'none';
      const name = c.owner?.fullName ?? 'Chưa phân công';
      addTo(buckets, key, name, c.id, c.subtotal, c.total);
    } else {
      const key = monthKey(c.startDate);
      addTo(buckets, key, key, c.id, c.subtotal, c.total);
    }
  }
  const rows: RevenueRow[] = [...buckets.entries()].map(([key, b]) => ({
    key,
    name: b.name,
    contracts: b.contractIds.size,
    subtotal: b.subtotal,
    total: b.total,
  }));
  return groupBy === 'month'
    ? rows.sort((a, b) => a.key.localeCompare(b.key))
    : rows.sort((a, b) => b.subtotal.comparedTo(a.subtotal));
}

export function sumDecimals(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((acc, v) => acc.plus(v), ZERO);
}

export interface ReceivableContract {
  total: Prisma.Decimal;
  customer: { id: string; name: string; taxCode: string };
  installments: {
    id: string;
    amount: Prisma.Decimal;
    dueDate: Date;
    /** 07 J10: đợt chờ phát hành BCKT không tính quá hạn. */
    dueRule: InstallmentDueRule;
    milestoneDate: Date | null;
    allocations: { amount: Prisma.Decimal }[];
  }[];
  payments: { amount: Prisma.Decimal }[];
}

export interface ReceivableRow {
  customerId: string;
  customerName: string;
  taxCode: string;
  contracts: number;
  total: Prisma.Decimal;
  paid: Prisma.Decimal;
  remaining: Prisma.Decimal;
  overdue: Prisma.Decimal;
}

/** Công nợ theo khách hàng; quá hạn theo phân bổ đã lưu của từng HĐ (quy tắc chung 07 — sửa R1). */
export function summarizeReceivables(
  contracts: ReceivableContract[],
  today: Date,
): ReceivableRow[] {
  const rows = new Map<string, ReceivableRow>();
  for (const c of contracts) {
    const { paid, remaining, overdueAmount } = contractReceivable(c, today);
    const row = rows.get(c.customer.id) ?? {
      customerId: c.customer.id,
      customerName: c.customer.name,
      taxCode: c.customer.taxCode,
      contracts: 0,
      total: ZERO,
      paid: ZERO,
      remaining: ZERO,
      overdue: ZERO,
    };
    row.contracts += 1;
    row.total = row.total.plus(c.total);
    row.paid = row.paid.plus(paid);
    row.remaining = row.remaining.plus(
      remaining.isNegative() ? ZERO : remaining,
    );
    row.overdue = row.overdue.plus(overdueAmount);
    rows.set(c.customer.id, row);
  }
  return [...rows.values()].sort((a, b) => b.remaining.comparedTo(a.remaining));
}

export interface ComplianceTask {
  dueDate: Date;
  status: TaskStatus;
  completedAt: Date | null;
  assignee: { id: string; fullName: string } | null;
}

export interface ComplianceStat {
  onTime: number;
  late: number;
  overdueOpen: number;
  onTimeRate: number | null;
}

function emptyStat(): ComplianceStat {
  return { onTime: 0, late: 0, overdueOpen: 0, onTimeRate: null };
}

function addTask(stat: ComplianceStat, task: ComplianceTask, today: Date) {
  if (task.status === TaskStatus.COMPLETED) {
    // Việc Hoàn thành không ghi thời điểm hoàn thành coi như đúng hạn.
    const onTime =
      !task.completedAt || isOnTime(task.completedAt, task.dueDate);
    if (onTime) stat.onTime += 1;
    else stat.late += 1;
  } else if (task.dueDate < today) {
    stat.overdueOpen += 1;
  }
  stat.onTimeRate = ratePercent(stat.onTime, stat.onTime + stat.late);
}

/** Tuân thủ deadline: việc DONE đúng hạn / trễ hạn và việc chưa xong đã quá hạn, theo tháng (của hạn) và theo nhân viên. */
export function summarizeCompliance(
  tasks: ComplianceTask[],
  period: Period,
  today: Date,
) {
  const byMonth = new Map<string, ComplianceStat>(
    monthsOf(period).map((m) => [m, emptyStat()]),
  );
  const byStaff = new Map<string, ComplianceStat & { name: string }>();
  const totals = emptyStat();
  for (const task of tasks) {
    const key = monthKey(task.dueDate);
    const month = byMonth.get(key) ?? emptyStat();
    addTask(month, task, today);
    byMonth.set(key, month);
    const staffKey = task.assignee?.id ?? 'none';
    const staff = byStaff.get(staffKey) ?? {
      ...emptyStat(),
      name: task.assignee?.fullName ?? 'Chưa phân công',
    };
    addTask(staff, task, today);
    byStaff.set(staffKey, staff);
    addTask(totals, task, today);
  }
  return {
    from: formatBusinessDate(period.from),
    to: formatBusinessDate(period.to),
    byMonth: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, stat]) => ({ month, ...stat })),
    byStaff: [...byStaff.entries()]
      .map(([userId, stat]) => ({ userId, ...stat }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    totals,
  };
}
