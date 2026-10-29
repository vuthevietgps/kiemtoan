import { Prisma } from '@prisma/client';
import { reallocateContract } from '../../payments/payment-allocation';
import { syncMilestoneDues } from '../../payments/installment-milestone';
import { ContractState, StoredScheduleItem } from './amendment-state';
import { ResultLine } from './amendment.calculator';

type Tx = Prisma.TransactionClient;

/** Áp dòng dịch vụ sau phụ lục vào HĐ: xoá dòng bỏ, cập nhật dòng sửa, tạo dòng mới. */
export async function applyLines(
  tx: Tx,
  state: ContractState,
  lines: ResultLine[],
  removed: string[],
) {
  if (removed.length)
    await tx.contractService.deleteMany({ where: { id: { in: removed } } });
  for (const line of lines) {
    const data = {
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
    };
    if (line.id)
      await tx.contractService.update({ where: { id: line.id }, data });
    else
      // Dòng mới đi qua kế hoạch thực hiện (04-B) trước khi sinh việc.
      await tx.contractService.create({
        data: {
          ...data,
          contractId: state.contract.id,
          serviceTypeId: line.serviceTypeId,
          period: line.period,
          assigneeId: line.assigneeId,
        },
      });
  }
}

/** Áp lịch đợt thanh toán sau phụ lục; đợt bị bỏ (chưa thu) gỡ khỏi phiếu thu rồi xoá. */
export async function applySchedule(
  tx: Tx,
  state: ContractState,
  schedule: StoredScheduleItem[],
) {
  const kept = new Set(schedule.map((i) => i.id).filter(Boolean));
  const dropped = state.installments
    .filter((i) => !kept.has(i.id))
    .map((i) => i.id);
  if (dropped.length) {
    await tx.payment.updateMany({
      where: { installmentId: { in: dropped } },
      data: { installmentId: null },
    });
    await tx.paymentInstallment.deleteMany({
      where: { id: { in: dropped } },
    });
  }
  for (const [index, item] of schedule.entries()) {
    const data = {
      name: item.name,
      amount: item.amount,
      dueDate: new Date(item.dueDate),
      sortOrder: index + 1,
    };
    if (item.id)
      await tx.paymentInstallment.update({ where: { id: item.id }, data });
    else
      await tx.paymentInstallment.create({
        data: { ...data, contractId: state.contract.id },
      });
  }
  // 07 (J4): lịch đợt đổi → phân bổ lại phiếu đã thu; J10: đợt cũ theo mốc BCKT giữ quy tắc, tính lại hạn.
  await reallocateContract(tx, state.contract.id);
  await syncMilestoneDues(tx, state.contract.id);
}
