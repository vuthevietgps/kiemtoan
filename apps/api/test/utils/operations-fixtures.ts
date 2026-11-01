import {
  ContractStatus,
  ServiceStatus,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { addDays, todayUtc } from '../../src/modules/tasks/task-filters';
import type { TestContext } from './test-app';

/**
 * Dữ liệu e2e tab Vận hành (10-B): KH A (nhân viên `staff`) có HĐ đang thực hiện 2 dịch vụ (1 xong qua
 * việc hoàn thành hôm nay), 5 việc (mở, quá hạn ưu tiên cao, xong, chờ KTT duyệt, tạm dừng quá hạn), 3 yêu
 * cầu hồ sơ, 2 kỳ báo cáo; KH B (`staff2`, nhóm khác) có HĐ đang thực hiện, 1 việc, 1 yêu cầu; thông báo.
 */
export async function seedOperationsData(ctx: TestContext) {
  const ids: Record<string, string> = {};
  const today = todayUtc();
  const { prisma, users } = ctx;
  const customer = (name: string, taxCode: string, ownerId: string) =>
    prisma.customer.create({ data: { name, taxCode, ownerId } });
  const a = await customer('Công ty Vận Hành A', 'OPS-A', users.staff.id);
  const b = await customer('Công ty Vận Hành B', 'OPS-B', users.staff2.id);
  const type = await prisma.serviceType.create({
    data: { code: 'OPS-KT', name: 'Kế toán thuế' },
  });
  const contract = (
    code: string,
    customerId: string,
    status: ContractStatus,
    services: ServiceStatus[],
  ) =>
    prisma.contract.create({
      data: {
        code,
        customerId,
        status,
        startDate: addDays(today, -30),
        services: {
          create: services.map((s) => ({
            serviceTypeId: type.id,
            amount: 1_000_000,
            unitPrice: 1_000_000,
            status: s,
          })),
        },
      },
      include: { services: { orderBy: { status: 'asc' } } },
    });
  const ca = await contract('HD-OPS-A', a.id, ContractStatus.IN_PROGRESS, [
    ServiceStatus.IN_PROGRESS,
    ServiceStatus.COMPLETED,
  ]);
  await contract('HD-OPS-B', b.id, ContractStatus.IN_PROGRESS, [
    ServiceStatus.NOT_STARTED,
  ]);
  await contract('HD-OPS-C', a.id, ContractStatus.DRAFT, [
    ServiceStatus.NOT_STARTED,
  ]);
  const [open, done] = ca.services;
  ids.ca = ca.id;
  ids.serviceDone = done.id;
  ids.serviceOpen = open.id;
  const task = (title: string, extra: object) =>
    prisma.task.create({
      data: {
        customerId: a.id,
        title,
        assigneeId: users.staff.id,
        dueDate: today,
        originalDueDate: today,
        ...extra,
      },
    });
  const due = (n: number) => ({
    dueDate: addDays(today, n),
    originalDueDate: addDays(today, n),
  });
  await task('Việc mở', { ...due(3), contractServiceId: open.id });
  await task('Việc quá hạn', {
    ...due(-2),
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
  });
  await task('Việc xong', {
    ...due(-1),
    status: TaskStatus.COMPLETED,
    completedAt: new Date(),
    contractServiceId: done.id,
  });
  await task('Việc chờ duyệt', {
    ...due(5),
    status: TaskStatus.IN_REVIEW,
    reviewLevels: 1,
    reviewLevel: 1,
    reviewerId: users.manager.id,
  });
  await task('Việc tạm dừng', { ...due(-10), status: TaskStatus.ON_HOLD });
  await prisma.task.create({
    data: {
      customerId: b.id,
      title: 'Việc của B',
      assigneeId: users.staff2.id,
      ...due(1),
    },
  });
  await prisma.customerDocumentRequest.createMany({
    data: [
      { customerId: a.id, name: 'Sao kê', status: 'REQUESTED' },
      { customerId: a.id, name: 'Hoá đơn', status: 'NEEDS_SUPPLEMENT' },
      { customerId: a.id, name: 'Hợp đồng', status: 'ACCEPTED' },
      { customerId: b.id, name: 'Sổ phụ', status: 'REQUESTED' },
    ],
  });
  const obligationType = await prisma.obligationType.create({
    data: {
      code: 'OPS-GTGT',
      name: 'Tờ khai GTGT',
      family: 'OPS-GTGT',
      cycle: 'MONTHLY',
      versions: {
        create: {
          versionNo: 1,
          status: 'CONFIRMED',
          effectiveFrom: addDays(today, -400),
          dueRule: 'MONTH_AFTER_END',
          monthsAfter: 1,
          dueDay: 20,
        },
      },
    },
    include: { versions: true },
  });
  for (const [period, status] of [
    ['2026-09', 'NOT_DUE'],
    ['2026-08', 'FILED'],
  ] as const)
    await prisma.customerObligation.create({
      data: {
        customerId: a.id,
        obligationTypeId: obligationType.id,
        versionId: obligationType.versions[0].id,
        period,
        periodEnd: addDays(today, -20),
        ...due(7),
        status,
      },
    });
  await prisma.notification.createMany({
    data: [
      {
        userId: users.staff.id,
        title: 'Quá hạn: Việc quá hạn',
        severity: 'DANGER',
      },
      { userId: users.staff.id, title: 'Tin thường', severity: 'INFO' },
      {
        userId: users.staff.id,
        title: 'Đã đọc',
        severity: 'WARNING',
        readAt: new Date(),
      },
    ],
  });
  return ids;
}
