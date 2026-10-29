import {
  ContractStatus,
  InstallmentDueRule,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import {
  allocateContract,
  summarizeReceivable,
  type InstallmentBalance,
  type ReceivableSummary,
} from '../../common/receivables';

type Db = Prisma.TransactionClient;

/**
 * Phiếu thu được tính vào đã thu / công nợ (07, J2): chỉ phiếu **Đã duyệt**. Mọi nơi đọc tiền (thu tiền,
 * HĐ, KH, dashboard, báo cáo, file xuất) dùng chung điều kiện này.
 */
export const COUNTED_PAYMENT = {
  deletedAt: null,
  status: PaymentStatus.APPROVED,
} satisfies Prisma.PaymentWhereInput;

/** Hợp đồng chưa duyệt / huỷ không phát sinh công nợ, không quá hạn (J7, J12). */
export const RECEIVABLE_EXCLUDED: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.PENDING_APPROVAL,
  ContractStatus.CANCELLED,
];

/** Thứ tự ghi nhận phiếu khi phân bổ (J4): theo lúc duyệt; dữ liệu chuyển đổi (không có lúc duyệt) trước. */
export const PAYMENT_ALLOCATION_ORDER = [
  { approvedAt: { sort: 'asc', nulls: 'first' } },
  { createdAt: 'asc' },
  { code: 'asc' },
] satisfies Prisma.PaymentOrderByWithRelationInput[];

/** Đợt kèm tiền đã phân bổ — chọn trong mọi truy vấn công nợ. */
export const INSTALLMENT_BALANCE_SELECT = {
  id: true,
  name: true,
  amount: true,
  dueDate: true,
  sortOrder: true,
  dueRule: true,
  dueOffsetDays: true,
  milestoneDate: true,
  allocations: { select: { amount: true } },
} satisfies Prisma.PaymentInstallmentSelect;

type InstallmentRow = Prisma.PaymentInstallmentGetPayload<{
  select: typeof INSTALLMENT_BALANCE_SELECT;
}>;

/** Tiền đã phân bổ vào một đợt. */
export function allocatedOf(installment: Pick<InstallmentRow, 'allocations'>) {
  return installment.allocations.reduce(
    (acc, a) => acc.add(a.amount),
    new Prisma.Decimal(0),
  );
}

/** Công nợ một HĐ từ dữ liệu đã lưu (tổng HĐ, đợt kèm phân bổ, phiếu được tính). */
export function contractReceivable(
  contract: {
    total: Prisma.Decimal;
    installments: Pick<
      InstallmentRow,
      'id' | 'amount' | 'dueDate' | 'allocations' | 'dueRule' | 'milestoneDate'
    >[];
    payments: { amount: Prisma.Decimal }[];
  },
  today: Date,
): ReceivableSummary {
  const paid = contract.payments.reduce(
    (acc, p) => acc.add(p.amount),
    new Prisma.Decimal(0),
  );
  return summarizeReceivable(
    contract.total,
    balancesOf(contract.installments),
    paid,
    today,
  );
}

/** Đợt kèm tiền đã phân bổ, dạng đầu vào của quy tắc công nợ chung. */
export function balancesOf(
  installments: Pick<
    InstallmentRow,
    'id' | 'amount' | 'dueDate' | 'allocations' | 'dueRule' | 'milestoneDate'
  >[],
): InstallmentBalance[] {
  return installments.map((i) => ({
    id: i.id,
    amount: i.amount,
    dueDate: i.dueDate,
    allocated: allocatedOf(i),
    awaitingMilestone:
      i.dueRule === InstallmentDueRule.AFTER_REPORT_ISSUE && !i.milestoneDate,
  }));
}

/**
 * Phân bổ lại toàn bộ phiếu của một HĐ (J4) — gọi trong transaction mỗi khi phiếu thu hoặc lịch đợt
 * thay đổi. Khoá dòng HĐ để hai lệnh đồng thời không ghi chồng phân bổ.
 */
export async function reallocateContract(db: Db, contractId: string) {
  await db.$queryRaw`SELECT id FROM contracts WHERE id = ${contractId}::uuid FOR UPDATE`;
  const [installments, payments] = await Promise.all([
    db.paymentInstallment.findMany({
      where: { contractId },
      select: { id: true, amount: true, dueDate: true, sortOrder: true },
    }),
    db.payment.findMany({
      where: { contractId, ...COUNTED_PAYMENT },
      select: { id: true, amount: true, installmentId: true },
      orderBy: PAYMENT_ALLOCATION_ORDER,
    }),
  ]);
  await db.paymentAllocation.deleteMany({
    where: { installment: { contractId } },
  });
  const allocations = allocateContract(installments, payments);
  if (allocations.length)
    await db.paymentAllocation.createMany({ data: allocations });
}
