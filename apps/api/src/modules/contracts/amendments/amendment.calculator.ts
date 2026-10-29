import { BadRequestException } from '@nestjs/common';
import { AmendmentLineAction, Prisma } from '@prisma/client';
import { computeTotals, sumDecimal } from '../contract-calculator';

const Decimal = Prisma.Decimal;

/** Dòng dịch vụ hiện có của HĐ, kèm cờ đã có công việc. */
export interface CurrentLine {
  id: string;
  serviceTypeId: string;
  name: string;
  description: string | null;
  period: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  assigneeId: string | null;
  hasTasks: boolean;
  /** Đã có hồ sơ kiểm toán (04-F): không bỏ để giữ mốc giai đoạn và lịch sử vai. */
  hasAudit?: boolean;
}

export interface LineChange {
  action: AmendmentLineAction;
  contractServiceId?: string | null;
  serviceTypeId?: string | null;
  description?: string | null;
  period?: string | null;
  quantity?: number | null;
  unitPrice?: string | Prisma.Decimal | null;
  assigneeId?: string | null;
}

/** Dòng dịch vụ sau phụ lục; `id` null là dòng mới. */
export interface ResultLine {
  id: string | null;
  serviceTypeId: string;
  description: string | null;
  period: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
  assigneeId: string | null;
}

export interface ScheduleItem {
  id?: string | null;
  name: string;
  amount: string | Prisma.Decimal;
  dueDate: string | Date;
}

/** Đợt hiện có kèm số đã thu phân bổ vào đợt. */
export interface CurrentInstallment {
  id: string;
  name: string;
  amount: Prisma.Decimal;
  dueDate: Date;
  paid: Prisma.Decimal;
}

const fail = (message: string): never => {
  throw new BadRequestException(message);
};

/**
 * Áp các thay đổi của phụ lục lên dòng dịch vụ hiện có (E6). Dòng đã có công việc không bỏ được
 * (05 chưa có trạng thái huỷ việc); đổi giá/số lượng thì được. Trả về dòng sau phụ lục và tổng tiền.
 */
export function applyLineChanges(
  current: CurrentLine[],
  changes: LineChange[],
  vatRate: Prisma.Decimal | number,
) {
  const byId = new Map(current.map((line) => [line.id, line]));
  const touched = new Set<string>();
  const removed = new Set<string>();
  const updates = new Map<string, LineChange>();
  const added: LineChange[] = [];
  for (const change of changes) {
    if (change.action === AmendmentLineAction.ADD) {
      if (!change.serviceTypeId || !change.quantity || change.unitPrice == null)
        fail('Dòng thêm mới cần dịch vụ, số lượng và đơn giá');
      added.push(change);
      continue;
    }
    const line = change.contractServiceId
      ? byId.get(change.contractServiceId)
      : undefined;
    if (!line) return fail('Dòng dịch vụ cần sửa/bỏ không thuộc hợp đồng');
    if (touched.has(line.id))
      fail(`Dòng ${line.name} xuất hiện nhiều lần trong phụ lục`);
    touched.add(line.id);
    if (change.action === AmendmentLineAction.REMOVE) {
      if (line.hasTasks)
        fail(`Dòng ${line.name} đã có công việc nên không bỏ được`);
      if (line.hasAudit)
        fail(`Dòng ${line.name} đã có hồ sơ kiểm toán nên không bỏ được`);
      removed.add(line.id);
    } else updates.set(line.id, change);
  }
  const lines: ResultLine[] = [
    ...current
      .filter((line) => !removed.has(line.id))
      .map((line) => {
        const change = updates.get(line.id);
        return toResult(line.id, {
          serviceTypeId: line.serviceTypeId,
          description:
            change?.description !== undefined
              ? change.description
              : line.description,
          period: line.period,
          quantity: change?.quantity ?? line.quantity,
          unitPrice: change?.unitPrice ?? line.unitPrice,
          assigneeId: line.assigneeId,
        });
      }),
    ...added.map((change) =>
      toResult(null, {
        serviceTypeId: change.serviceTypeId!,
        description: change.description ?? null,
        period: change.period ?? null,
        quantity: change.quantity!,
        unitPrice: change.unitPrice!,
        assigneeId: change.assigneeId ?? null,
      }),
    ),
  ];
  if (!lines.length) fail('Hợp đồng sau phụ lục phải còn ít nhất một dòng');
  const totals = computeTotals(lines, vatRate);
  return {
    lines,
    removed: [...removed],
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
  };
}

function toResult(
  id: string | null,
  line: Omit<ResultLine, 'id' | 'amount' | 'unitPrice'> & {
    unitPrice: string | Prisma.Decimal;
  },
): ResultLine {
  const unitPrice = new Decimal(line.unitPrice);
  return { ...line, id, unitPrice, amount: unitPrice.mul(line.quantity) };
}

/**
 * Lịch thanh toán đề xuất khi phụ lục không gửi lịch: tăng thì thêm một đợt bổ sung,
 * giảm thì trừ vào phần chưa thu của các đợt từ cuối lên.
 */
export function suggestSchedule(
  current: CurrentInstallment[],
  newTotal: Prisma.Decimal,
  label: string,
  dueDate: Date,
): ScheduleItem[] {
  const items = current.map((i) => ({
    id: i.id,
    name: i.name,
    amount: new Decimal(i.amount),
    dueDate: i.dueDate,
    paid: i.paid,
  }));
  let delta = newTotal.sub(sumDecimal(items.map((i) => i.amount)));
  if (delta.gt(0))
    return [
      ...items.map(stripPaid),
      { name: `Bổ sung theo ${label}`, amount: delta, dueDate },
    ];
  for (let index = items.length - 1; index >= 0 && delta.lt(0); index--) {
    const item = items[index];
    const cut = Decimal.min(item.amount.sub(item.paid), delta.neg());
    item.amount = item.amount.sub(cut);
    delta = delta.add(cut);
  }
  if (delta.lt(0)) fail('Tổng hợp đồng sau phụ lục nhỏ hơn số tiền đã thu');
  return items.filter((i) => i.amount.gt(0) || i.paid.gt(0)).map(stripPaid);
}

const stripPaid = ({ id, name, amount, dueDate }: ScheduleItem) => ({
  id,
  name,
  amount,
  dueDate,
});

/**
 * Kiểm tra lịch sau phụ lục: đợt cũ phải thuộc HĐ, không bỏ/giảm dưới số đã thu,
 * số tiền dương và tổng bằng tổng HĐ sau phụ lục.
 */
export function validateSchedule(
  current: CurrentInstallment[],
  schedule: ScheduleItem[],
  newTotal: Prisma.Decimal,
): void {
  if (!schedule.length) fail('Phụ lục cần ít nhất một đợt thanh toán');
  const byId = new Map(current.map((i) => [i.id, i]));
  const kept = new Set<string>();
  for (const item of schedule) {
    const amount = new Decimal(item.amount);
    if (amount.lte(0)) fail('Số tiền mỗi đợt phải lớn hơn 0');
    if (!item.id) continue;
    const existing = byId.get(item.id);
    if (!existing || kept.has(item.id))
      fail('Đợt thanh toán không thuộc hợp đồng hoặc bị lặp');
    kept.add(item.id);
    if (amount.lt(existing!.paid))
      fail(`Đợt ${existing!.name} không được nhỏ hơn số đã thu`);
  }
  const dropped = current.find((i) => !kept.has(i.id) && i.paid.gt(0));
  if (dropped) fail(`Đợt ${dropped.name} đã thu tiền nên không bỏ được`);
  if (!sumDecimal(schedule.map((i) => i.amount)).eq(newTotal))
    fail('Tổng các đợt thanh toán phải bằng tổng hợp đồng sau phụ lục');
}
