import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AmendmentLineAction, ContractStatus, Prisma } from '@prisma/client';
import {
  allocatedOf,
  COUNTED_PAYMENT,
} from '../../payments/payment-allocation';
import {
  applyLineChanges,
  CurrentInstallment,
  CurrentLine,
  LineChange,
  ScheduleItem,
  suggestSchedule,
  validateSchedule,
} from './amendment.calculator';

/** HĐ đã duyệt, chưa thanh lý/huỷ mới lập và duyệt phụ lục. */
export const AMENDABLE: ContractStatus[] = [
  ContractStatus.NOT_STARTED,
  ContractStatus.IN_PROGRESS,
  ContractStatus.COMPLETED,
];

export const amendmentLabel = (number: number) =>
  `PL-${String(number).padStart(2, '0')}`;

const day = (date: Date) => date.toISOString().slice(0, 10);

/** Trạng thái hiện tại của HĐ cần cho phụ lục: dòng dịch vụ (có việc chưa), đợt và số đã thu. */
export async function loadContractState(
  tx: Prisma.TransactionClient,
  contractId: string,
) {
  const contract = await tx.contract.findUnique({
    where: { id: contractId },
    include: {
      services: {
        include: {
          serviceType: { select: { name: true } },
          _count: { select: { tasks: { where: { deletedAt: null } } } },
          audit: { select: { id: true } },
        },
      },
      installments: {
        orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
        include: { allocations: { select: { amount: true } } },
      },
      payments: {
        where: COUNTED_PAYMENT,
        select: { amount: true, installmentId: true },
      },
    },
  });
  if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
  const lines: CurrentLine[] = contract.services.map((s) => ({
    id: s.id,
    serviceTypeId: s.serviceTypeId,
    name: s.serviceType.name,
    description: s.description,
    period: s.period,
    quantity: s.quantity,
    unitPrice: s.unitPrice,
    assigneeId: s.assigneeId,
    hasTasks: s._count.tasks > 0,
    hasAudit: s.audit !== null,
  }));
  const installments: CurrentInstallment[] = contract.installments.map((i) => ({
    id: i.id,
    name: i.name,
    amount: i.amount,
    dueDate: i.dueDate,
    paid: allocatedOf(i),
  }));
  return { contract, lines, installments };
}

export type ContractState = Awaited<ReturnType<typeof loadContractState>>;

/** Dấu trạng thái tiền của HĐ (dòng dịch vụ, đợt) để phát hiện phụ lục lập trên số liệu cũ. */
export function fingerprintOf(state: ContractState): string {
  const lines = state.lines
    .map((l) => `${l.id}:${l.quantity}:${l.unitPrice.toFixed(2)}`)
    .sort();
  const installments = state.installments
    .map((i) => `${i.id}:${i.amount.toFixed(2)}:${day(i.dueDate)}`)
    .sort();
  return [...lines, '|', ...installments].join(',');
}

/**
 * Tính HĐ sau phụ lục và lịch thanh toán (đề xuất nếu không gửi), kiểm tra dịch vụ/người mới.
 * Dùng khi lưu, gửi duyệt và duyệt (khi duyệt tính lại trên dữ liệu mới nhất).
 */
export async function prepareAmendment(
  tx: Prisma.TransactionClient,
  state: ContractState,
  input: {
    number: number;
    lines: LineChange[];
    installments?: ScheduleItem[] | null;
    effectiveDate?: Date | null;
  },
) {
  const added = input.lines.filter((l) => l.action === AmendmentLineAction.ADD);
  const typeIds = [...new Set(added.map((l) => l.serviceTypeId!))];
  const activeTypes = await tx.serviceType.count({
    where: { id: { in: typeIds }, isActive: true },
  });
  if (activeTypes !== typeIds.length)
    throw new BadRequestException(
      'Dịch vụ thêm mới không tồn tại hoặc đã ngừng',
    );
  const userIds = [
    ...new Set(added.map((l) => l.assigneeId).filter((v): v is string => !!v)),
  ];
  const activeUsers = await tx.user.count({
    where: { id: { in: userIds }, deletedAt: null, isActive: true },
  });
  if (activeUsers !== userIds.length)
    throw new BadRequestException('Người thực hiện không tồn tại hoặc đã nghỉ');
  const result = applyLineChanges(
    state.lines,
    input.lines,
    state.contract.vatRate,
  );
  const schedule =
    input.installments ??
    suggestSchedule(
      state.installments,
      result.total,
      amendmentLabel(input.number),
      input.effectiveDate ?? new Date(Date.now() + 30 * 86_400_000),
    );
  validateSchedule(state.installments, schedule, result.total);
  return { result, schedule: schedule.map(toStoredItem) };
}

export interface StoredScheduleItem {
  id?: string | null;
  name: string;
  amount: string;
  dueDate: string;
}

function toStoredItem(item: ScheduleItem): StoredScheduleItem {
  const dueDate =
    item.dueDate instanceof Date
      ? day(item.dueDate)
      : item.dueDate.slice(0, 10);
  return {
    ...(item.id ? { id: item.id } : {}),
    name: item.name,
    amount: new Prisma.Decimal(item.amount).toFixed(2),
    dueDate,
  };
}

/** Ảnh chụp HĐ để lưu lịch sử trước–sau (giá trị tiền dạng chuỗi). */
export function snapshotOf(
  lines: {
    id: string | null;
    serviceTypeId: string;
    period: string | null;
    quantity: number;
    unitPrice: Prisma.Decimal;
    amount?: Prisma.Decimal;
  }[],
  installments: {
    id?: string | null;
    name: string;
    amount: Prisma.Decimal | string;
    dueDate: Date | string;
  }[],
  totals: {
    subtotal: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
    total: Prisma.Decimal;
  },
): Prisma.InputJsonObject {
  return {
    subtotal: totals.subtotal.toFixed(2),
    vatAmount: totals.vatAmount.toFixed(2),
    total: totals.total.toFixed(2),
    services: lines.map((l) => ({
      id: l.id,
      serviceTypeId: l.serviceTypeId,
      period: l.period,
      quantity: l.quantity,
      unitPrice: l.unitPrice.toFixed(2),
      amount: (l.amount ?? l.unitPrice.mul(l.quantity)).toFixed(2),
    })),
    installments: installments.map((i) => ({
      id: i.id ?? null,
      name: i.name,
      amount: new Prisma.Decimal(i.amount).toFixed(2),
      dueDate: i.dueDate instanceof Date ? day(i.dueDate) : i.dueDate,
    })),
  };
}
