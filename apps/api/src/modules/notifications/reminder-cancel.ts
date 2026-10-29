import {
  DeliveryChannel,
  DeliveryStatus,
  ObligationStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';

/**
 * I12: email nhắc còn chờ gửi mà không còn đúng — hạn đã đổi (mốc mới có khoá mới), việc đã xong/tạm
 * dừng/xoá, nghĩa vụ đã nộp/không áp dụng, lượt soát xét đã qua — chuyển sang Huỷ. Trả số dòng huỷ.
 */
export async function cancelStaleEmails(
  db: Prisma.TransactionClient,
): Promise<number> {
  const pending = await db.notificationDelivery.findMany({
    where: {
      channel: DeliveryChannel.EMAIL,
      status: DeliveryStatus.PENDING,
      subjectType: { in: ['TASK', 'OBLIGATION'] },
    },
    select: {
      id: true,
      subjectType: true,
      subjectId: true,
      milestone: true,
      dueKey: true,
    },
  });
  if (!pending.length) return 0;
  const ids = (type: string) =>
    pending.filter((p) => p.subjectType === type).map((p) => p.subjectId);
  const [tasks, obligations] = await Promise.all([
    db.task.findMany({
      where: { id: { in: ids('TASK') } },
      select: { id: true, dueDate: true, status: true, deletedAt: true },
    }),
    db.customerObligation.findMany({
      where: { id: { in: ids('OBLIGATION') } },
      select: { id: true, dueDate: true, status: true },
    }),
  ]);
  const task = new Map(tasks.map((t) => [t.id, t]));
  const obligation = new Map(obligations.map((o) => [o.id, o]));
  const stale = pending.filter((p) => {
    if (p.subjectType === 'OBLIGATION') {
      const o = obligation.get(p.subjectId);
      return (
        !o ||
        (o.status !== ObligationStatus.NOT_DUE &&
          o.status !== ObligationStatus.PREPARING) ||
        o.dueDate.getTime() !== p.dueKey.getTime()
      );
    }
    const t = task.get(p.subjectId);
    if (!t || t.deletedAt || t.status === TaskStatus.COMPLETED) return true;
    if (p.milestone.startsWith('SLA')) return t.status !== TaskStatus.IN_REVIEW;
    return (
      t.status === TaskStatus.ON_HOLD ||
      t.dueDate.getTime() !== p.dueKey.getTime()
    );
  });
  if (!stale.length) return 0;
  const { count } = await db.notificationDelivery.updateMany({
    where: {
      id: { in: stale.map((s) => s.id) },
      status: DeliveryStatus.PENDING,
    },
    data: {
      status: DeliveryStatus.CANCELLED,
      lastError: 'Hạn hoặc trạng thái đã đổi',
    },
  });
  return count;
}
