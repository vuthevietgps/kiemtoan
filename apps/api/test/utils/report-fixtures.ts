import { ContractStatus, ServiceStatus, TaskStatus } from '@prisma/client';
import {
  addDays,
  currentMonth,
  previousPeriod,
  todayVn,
} from '../../src/modules/reports/utils/period.util';
import { TestContext } from './test-app';
import { reallocateContract } from '../../src/modules/payments/payment-allocation';

/**
 * Dữ liệu cho e2e tổng quan / báo cáo (agent D):
 * - Công ty A (nhân viên `staff` phụ trách): HĐ-T-001 trong tháng 1.000.000 (+VAT 10%), 2 dòng dịch vụ (1 xong),
 *   thu 300.000 (+1 phiếu đã xoá); HĐ-T-003 nháp; HĐ-T-004 kỳ trước 500.000.
 * - Công ty B (`staff2`): HĐ-T-002 trong tháng 2.000.000, có đợt thanh toán quá hạn 1.000.000.
 * - Việc: staff có 1 chưa làm (hạn +3), 1 đang làm (hạn +20), 1 đã làm (trễ); staff2 có 1 chưa làm (hạn +2).
 */
export async function seedReportData(ctx: TestContext): Promise<void> {
  const { prisma, users } = ctx;
  const month = currentMonth();
  const prev = previousPeriod(month);
  const today = todayVn();

  const [a, b] = await Promise.all([
    prisma.customer.create({
      data: { name: 'Công ty A', taxCode: 'T-A-001', ownerId: users.staff.id },
    }),
    prisma.customer.create({
      data: { name: 'Công ty B', taxCode: 'T-B-001', ownerId: users.staff2.id },
    }),
  ]);
  const [tax, audit] = await Promise.all([
    prisma.serviceType.create({
      data: { code: 'T-KTT', name: 'Kế toán thuế' },
    }),
    prisma.serviceType.create({ data: { code: 'T-KT', name: 'Kiểm toán' } }),
  ]);

  const c1 = await prisma.contract.create({
    data: {
      code: 'HD-T-001',
      customerId: a.id,
      ownerId: users.staff.id,
      startDate: month.from,
      status: ContractStatus.IN_PROGRESS,
      subtotal: 1_000_000,
      vatAmount: 100_000,
      total: 1_100_000,
      services: {
        create: [
          {
            serviceTypeId: tax.id,
            unitPrice: 600_000,
            amount: 600_000,
            status: ServiceStatus.COMPLETED,
          },
          { serviceTypeId: audit.id, unitPrice: 400_000, amount: 400_000 },
        ],
      },
    },
  });
  await prisma.contract.create({
    data: {
      code: 'HD-T-002',
      customerId: b.id,
      ownerId: users.staff2.id,
      startDate: month.from,
      status: ContractStatus.NOT_STARTED,
      subtotal: 2_000_000,
      vatAmount: 200_000,
      total: 2_200_000,
      services: {
        create: [
          { serviceTypeId: tax.id, unitPrice: 2_000_000, amount: 2_000_000 },
        ],
      },
      installments: {
        create: [
          {
            name: 'Tạm ứng',
            amount: 1_000_000,
            dueDate: new Date('2020-01-01'),
          },
        ],
      },
    },
  });
  await prisma.contract.create({
    data: {
      code: 'HD-T-003',
      customerId: a.id,
      startDate: month.from,
      status: ContractStatus.DRAFT,
      subtotal: 9_999,
      total: 9_999,
    },
  });
  await prisma.contract.create({
    data: {
      code: 'HD-T-004',
      customerId: a.id,
      ownerId: users.staff.id,
      startDate: prev.from,
      status: ContractStatus.COMPLETED,
      subtotal: 500_000,
      vatAmount: 50_000,
      total: 550_000,
    },
  });

  await prisma.payment.createMany({
    data: [
      {
        code: 'PT-T-001',
        contractId: c1.id,
        amount: 300_000,
        paidDate: today,
        receivedById: users.cashier.id,
        status: 'APPROVED', // 07-C: phiếu đã thu = Đã duyệt
      },
      {
        code: 'PT-T-002',
        contractId: c1.id,
        amount: 100_000,
        paidDate: today,
        receivedById: users.cashier.id,
        status: 'CANCELLED', // 07-C: phiếu xoá mềm = Đã huỷ (như migration J15)
        deletedAt: new Date(),
      },
    ],
  });
  // 07-B: phiếu ghi thẳng vào DB → phân bổ vào đợt như khi thu qua ứng dụng (không đổi số liệu mẫu).
  await prisma.$transaction((tx) => reallocateContract(tx, c1.id));

  await prisma.task.createMany({
    data: [
      {
        customerId: a.id,
        title: 'Nộp tờ khai A',
        dueDate: addDays(today, 3),
        originalDueDate: addDays(today, 3),
        assigneeId: users.staff.id,
      },
      {
        customerId: a.id,
        title: 'Báo cáo tài chính A',
        dueDate: addDays(today, 20),
        originalDueDate: addDays(today, 20),
        status: TaskStatus.IN_PROGRESS,
        assigneeId: users.staff.id,
      },
      {
        customerId: a.id,
        title: 'Sổ sách A',
        dueDate: addDays(today, -1),
        originalDueDate: addDays(today, -1),
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        assigneeId: users.staff.id,
      },
      {
        customerId: b.id,
        title: 'Nộp tờ khai B',
        dueDate: addDays(today, 2),
        originalDueDate: addDays(today, 2),
        assigneeId: users.staff2.id,
      },
    ],
  });
}
