import { ContractStatus, TaskStatus } from '@prisma/client';
import {
  addDays,
  formatBusinessDate,
  todayVn,
} from '../../src/modules/reports/utils/period.util';
import type { TestContext } from './test-app';

/**
 * Dữ liệu e2e báo cáo vận hành 10-C, ngày tính theo hôm nay (t). Kỳ báo cáo [t−200, t+60].
 * - Lịch báo cáo KH A (`staff`): nộp đúng ngày hạn; nộp trễ 3 ngày có việc chờ khách đã xác nhận;
 *   quá hạn chưa nộp; chưa đến hạn; "Không áp dụng" (bỏ). KH B (`staff2`): nộp đúng hạn. Việc pháp lý
 *   không gắn nghĩa vụ của KH A xong trễ 1 ngày.
 * - Hợp đồng: A có C2 (kết thúc t−50) được tái ký bằng C3 (duyệt t−60); B có C4 kết thúc t−20 không tái
 *   ký; D có C1 duyệt t−100 (khách mới); E có C5 hết hạn t+70 (sắp hết hạn sau cuối kỳ); A có HĐ nháp.
 */
export async function seedOperationsReport(ctx: TestContext) {
  const { prisma, users } = ctx;
  const t = todayVn();
  const at = (n: number) => addDays(t, n);
  const moment = (n: number) => new Date(at(n).getTime() + 3 * 3_600_000);
  const customer = (key: string, ownerId: string) =>
    prisma.customer.create({
      data: { name: `Công ty Báo cáo ${key}`, taxCode: `RPT-${key}`, ownerId },
    });
  const a = await customer('A', users.staff.id);
  const b = await customer('B', users.staff2.id);
  const dCustomer = await customer('D', users.director.id);
  const e = await customer('E', users.director.id);

  const type = await prisma.obligationType.create({
    data: {
      code: 'RPT-GTGT',
      name: 'Tờ khai GTGT',
      family: 'RPT-GTGT',
      cycle: 'MONTHLY',
      versions: {
        create: {
          versionNo: 1,
          status: 'CONFIRMED',
          effectiveFrom: at(-800),
          dueRule: 'MONTH_AFTER_END',
          monthsAfter: 1,
          dueDay: 20,
        },
      },
    },
    include: { versions: true },
  });
  const obligation = (
    customerId: string,
    key: string,
    due: number,
    status: 'NOT_DUE' | 'PREPARING' | 'FILED' | 'NOT_APPLICABLE',
    filed?: number,
  ) =>
    prisma.customerObligation.create({
      data: {
        customerId,
        obligationTypeId: type.id,
        versionId: type.versions[0].id,
        period: key,
        periodEnd: at(due - 20),
        dueDate: at(due),
        originalDueDate: at(due),
        status,
        filedAt: filed === undefined ? null : at(filed),
      },
    });
  await obligation(a.id, 'K1', -40, 'FILED', -40);
  const late = await obligation(a.id, 'K2', -35, 'FILED', -32);
  await obligation(a.id, 'K3', -30, 'NOT_DUE');
  await obligation(a.id, 'K4', 30, 'PREPARING');
  await obligation(a.id, 'K5', -20, 'NOT_APPLICABLE');
  await obligation(b.id, 'K6', -10, 'FILED', -11);
  await prisma.task.create({
    data: {
      customerId: a.id,
      title: 'Nộp tờ khai K2',
      assigneeId: users.staff.id,
      dueDate: at(-35),
      originalDueDate: at(-35),
      status: TaskStatus.COMPLETED,
      completedAt: moment(-32),
      obligationId: late.id,
      isStatutory: true,
      clientWaits: {
        create: {
          fromStatus: TaskStatus.IN_PROGRESS,
          startedAt: moment(-40),
          endedAt: moment(-34),
          confirmedById: users.manager.id,
          confirmedAt: moment(-34),
        },
      },
    },
  });
  await prisma.task.create({
    data: {
      customerId: a.id,
      title: 'Nộp báo cáo thống kê',
      assigneeId: users.staff.id,
      dueDate: at(-15),
      originalDueDate: at(-15),
      status: TaskStatus.COMPLETED,
      completedAt: moment(-14),
      isStatutory: true,
    },
  });

  const contract = (
    code: string,
    customerId: string,
    status: ContractStatus,
    approved: number | null,
    start: number,
    end: number | null,
    renewedFromId?: string,
  ) =>
    prisma.contract.create({
      data: {
        code,
        customerId,
        status,
        approvedAt: approved === null ? null : moment(approved),
        startDate: at(start),
        endDate: end === null ? null : at(end),
        subtotal: 1_000_000,
        total: 1_100_000,
        renewedFromId,
      },
    });
  const c2 = await contract(
    'RPT-C2',
    a.id,
    ContractStatus.COMPLETED,
    -400,
    -400,
    -50,
  );
  await contract(
    'RPT-C3',
    a.id,
    ContractStatus.IN_PROGRESS,
    -60,
    -49,
    200,
    c2.id,
  );
  await contract('RPT-C4', b.id, ContractStatus.COMPLETED, -400, -400, -20);
  await contract(
    'RPT-C1',
    dCustomer.id,
    ContractStatus.IN_PROGRESS,
    -100,
    -100,
    null,
  );
  await contract('RPT-C5', e.id, ContractStatus.IN_PROGRESS, -300, -300, 70);
  await contract('RPT-C6', a.id, ContractStatus.DRAFT, null, -10, null);
  return {
    period: {
      from: formatBusinessDate(at(-200)),
      to: formatBusinessDate(at(60)),
    },
    ids: { a: a.id, b: b.id },
  };
}
