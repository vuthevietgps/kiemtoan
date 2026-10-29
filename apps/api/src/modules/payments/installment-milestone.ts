import { InstallmentDueRule, Prisma } from '@prisma/client';
import { reportMilestone } from '../../common/receivables';
import { reallocateContract } from './payment-allocation';

type Db = Prisma.TransactionClient;
const DAY_MS = 86_400_000;

/**
 * J10: cập nhật hạn các đợt "N ngày sau phát hành BCKT" của một HĐ theo mốc phát hành hiện tại — gọi
 * trong transaction khi phát hành / mở lại BCKT, lưu HĐ, áp phụ lục. Đủ mốc: hạn = ngày mốc + N;
 * chưa đủ (hoặc mở lại): bỏ mốc, đợt về "Chờ phát hành" (giữ ngày dự kiến). Đổi hạn thì phân bổ lại (J4).
 */
export async function syncMilestoneDues(
  db: Db,
  contractId: string,
): Promise<void> {
  const installments = await db.paymentInstallment.findMany({
    where: { contractId, dueRule: InstallmentDueRule.AFTER_REPORT_ISSUE },
    select: {
      id: true,
      dueDate: true,
      dueOffsetDays: true,
      milestoneDate: true,
    },
  });
  if (!installments.length) return;
  const lines = await db.contractService.findMany({
    where: { contractId, serviceType: { issuesAuditReport: true } },
    select: { audit: { select: { stage: true, reportDate: true } } },
  });
  const milestone = reportMilestone(
    lines.map((l) => ({
      issued: l.audit?.stage === 'ISSUED',
      reportDate: l.audit?.reportDate ?? null,
    })),
  );
  let changed = false;
  for (const i of installments) {
    const dueDate = milestone
      ? new Date(milestone.getTime() + (i.dueOffsetDays ?? 0) * DAY_MS)
      : i.dueDate;
    if (
      i.milestoneDate?.getTime() === milestone?.getTime() &&
      i.dueDate.getTime() === dueDate.getTime()
    )
      continue;
    await db.paymentInstallment.update({
      where: { id: i.id },
      data: { milestoneDate: milestone, dueDate },
    });
    changed = true;
  }
  if (changed) await reallocateContract(db, contractId);
}
