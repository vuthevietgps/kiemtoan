import { ContractStatus, Prisma, TaskStatus } from '@prisma/client';
import type { TestContext } from './test-app';

/**
 * Dữ liệu e2e Đánh giá năng lực (10-E), kỳ 05/2026 (giờ UTC; giờ VN = UTC+7). Việc của `staff`:
 * - T1 kỳ DV 2026-04: hạn 10/05, nộp 23:30 giờ VN ngày hạn (đúng hạn), được chấp nhận 11/05.
 * - T2 kỳ DV 2026-05: hạn gốc 20/05 gia hạn 2 lần (đã duyệt) đến 25/05, nộp 22/05, bị trả lại 2 lần, duyệt 25/05.
 * - T3 không gắn dịch vụ: hạn 12/05, chờ khách đã xác nhận 05→08/05 (3 ngày), nộp 16/05 (trễ 1 ngày sau
 *   khi cộng 3 ngày); khoảng chờ chưa xác nhận 09→12/05 không được cộng; đổi hạn theo lịch không phải gia hạn.
 * - T4 hạn pháp lý 20/05, nộp 08:00 giờ VN 21/05 (trễ 1 ngày).
 * - T5 dữ liệu chuyển đổi thiếu mốc nộp (không tính).
 * - T6 kiểm toán (dịch vụ phát hành BCKT): hạn 15/05, chưa nộp (quá hạn).
 * `staff2` (nhóm khác) có một việc đúng hạn. Nhóm thực hiện dòng kế toán: Trưởng nhóm `manager` tới
 * 15/05, sau đó `director`; Manager là `manager` suốt kỳ. `manager` soát xét T2 hai lượt (1 trả lại quá
 * SLA, 1 chấp nhận trong SLA).
 */
export async function seedCapabilityData(ctx: TestContext) {
  const { prisma, users } = ctx;
  const at = (iso: string) => new Date(iso);
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
  const customer = await prisma.customer.create({
    data: {
      name: 'Công ty Năng Lực',
      taxCode: 'CAP-A',
      ownerId: users.staff.id,
    },
  });
  const other = await prisma.customer.create({
    data: { name: 'Công ty Khác', taxCode: 'CAP-B', ownerId: users.staff2.id },
  });
  const accounting = await prisma.serviceType.create({
    data: { code: 'CAP-KT', name: 'Kế toán trọn gói' },
  });
  const audit = await prisma.serviceType.create({
    data: {
      code: 'CAP-KTOAN',
      name: 'Kiểm toán BCTC',
      issuesAuditReport: true,
    },
  });
  const contract = await prisma.contract.create({
    data: {
      code: 'HD-CAP-1',
      customerId: customer.id,
      status: ContractStatus.IN_PROGRESS,
      startDate: day('2026-01-01'),
      services: {
        create: [accounting, audit].map((t) => ({
          serviceTypeId: t.id,
          amount: 5_000_000,
          unitPrice: 5_000_000,
        })),
      },
    },
    include: { services: true },
  });
  const line = contract.services.find(
    (s) => s.serviceTypeId === accounting.id,
  )!;
  const auditLine = contract.services.find(
    (s) => s.serviceTypeId === audit.id,
  )!;
  await prisma.serviceTeam.create({
    data: {
      contractServiceId: line.id,
      roleHistory: {
        create: [
          {
            role: 'LEAD',
            userId: users.manager.id,
            fromAt: at('2026-01-01T00:00:00Z'),
            toAt: at('2026-05-15T03:00:00Z'),
          },
          {
            role: 'LEAD',
            userId: users.director.id,
            fromAt: at('2026-05-15T03:00:00Z'),
          },
          {
            role: 'MANAGER',
            userId: users.manager.id,
            fromAt: at('2026-01-01T00:00:00Z'),
          },
        ],
      },
    },
  });
  const task = (
    title: string,
    data: Partial<Prisma.TaskUncheckedCreateInput>,
  ) =>
    prisma.task.create({
      data: {
        customerId: customer.id,
        assigneeId: users.staff.id,
        title,
        dueDate: day('2026-05-10'),
        originalDueDate: day('2026-05-10'),
        ...data,
      },
    });
  await task('T1', {
    contractServiceId: line.id,
    period: '2026-04',
    reviewLevels: 1,
    status: TaskStatus.COMPLETED,
    firstSubmittedAt: at('2026-05-10T16:30:00Z'),
    acceptedAt: at('2026-05-11T03:00:00Z'),
    completedAt: at('2026-05-11T03:00:00Z'),
  });
  const t2 = await task('T2', {
    contractServiceId: line.id,
    period: '2026-05',
    reviewLevels: 1,
    status: TaskStatus.APPROVED,
    dueDate: day('2026-05-25'),
    originalDueDate: day('2026-05-20'),
    firstSubmittedAt: at('2026-05-22T03:00:00Z'),
    acceptedAt: at('2026-05-25T03:00:00Z'),
    returnCount: 2,
  });
  const t3 = await task('T3', {
    reviewLevels: 1,
    status: TaskStatus.IN_REVIEW,
    dueDate: day('2026-05-12'),
    originalDueDate: day('2026-05-12'),
    firstSubmittedAt: at('2026-05-16T03:00:00Z'),
  });
  await task('T4', {
    reviewLevels: 1,
    isStatutory: true,
    status: TaskStatus.IN_REVIEW,
    dueDate: day('2026-05-20'),
    originalDueDate: day('2026-05-20'),
    firstSubmittedAt: at('2026-05-21T01:00:00Z'),
  });
  await task('T5', {
    reviewLevels: 1,
    legacy: true,
    status: TaskStatus.COMPLETED,
    completedAt: at('2026-05-30T03:00:00Z'),
  });
  await task('T6', {
    contractServiceId: auditLine.id,
    status: TaskStatus.IN_PROGRESS,
    dueDate: day('2026-05-15'),
    originalDueDate: day('2026-05-15'),
  });
  await prisma.task.create({
    data: {
      customerId: other.id,
      assigneeId: users.staff2.id,
      title: 'T7',
      dueDate: day('2026-05-10'),
      originalDueDate: day('2026-05-10'),
      status: TaskStatus.COMPLETED,
      completedAt: at('2026-05-09T03:00:00Z'),
    },
  });
  await prisma.taskClientWait.createMany({
    data: [
      {
        taskId: t3.id,
        fromStatus: TaskStatus.IN_PROGRESS,
        startedAt: at('2026-05-05T02:00:00Z'),
        endedAt: at('2026-05-08T02:00:00Z'),
        confirmedById: users.manager.id,
        confirmedAt: at('2026-05-05T05:00:00Z'),
      },
      {
        taskId: t3.id,
        fromStatus: TaskStatus.IN_PROGRESS,
        startedAt: at('2026-05-09T02:00:00Z'),
        endedAt: at('2026-05-12T02:00:00Z'),
      },
    ],
  });
  await prisma.taskDueChange.createMany({
    data: [
      {
        taskId: t2.id,
        oldDue: day('2026-05-20'),
        newDue: day('2026-05-22'),
        reason: 'Khách bổ sung chứng từ',
        status: 'APPROVED',
        requestedById: users.staff.id,
        decidedById: users.manager.id,
        decidedAt: at('2026-05-18T03:00:00Z'),
      },
      {
        taskId: t2.id,
        oldDue: day('2026-05-22'),
        newDue: day('2026-05-25'),
        reason: 'Khách đổi người đối chiếu',
        status: 'APPROVED',
        requestedById: users.staff.id,
        decidedById: users.manager.id,
        decidedAt: at('2026-05-20T03:00:00Z'),
      },
      {
        taskId: t3.id,
        oldDue: day('2026-05-11'),
        newDue: day('2026-05-12'),
        reason: 'Lịch nghỉ bù',
        status: 'APPROVED',
        calendarAdjusted: true,
        requestedById: users.manager.id,
      },
    ],
  });
  await prisma.taskReview.createMany({
    data: [
      {
        taskId: t2.id,
        level: 1,
        reviewerId: users.manager.id,
        decision: 'RETURN',
        enteredAt: at('2026-05-18T02:00:00Z'),
        decidedAt: at('2026-05-22T02:00:00Z'),
      },
      {
        taskId: t2.id,
        level: 1,
        reviewerId: users.manager.id,
        decision: 'ACCEPT',
        enteredAt: at('2026-05-22T04:00:00Z'),
        decidedAt: at('2026-05-25T02:00:00Z'),
      },
    ],
  });
}
