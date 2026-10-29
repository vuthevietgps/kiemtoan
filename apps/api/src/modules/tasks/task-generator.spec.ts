import { ContractPlanStatus, PrismaClient } from '@prisma/client';
import {
  computeDueDate,
  endOfPeriod,
  generateTasks,
  generateTasksForContract,
  pickAssignee,
  WAITING_FOR_PLAN,
} from './task-generator';

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('task-generator', () => {
  describe('computeDueDate', () => {
    it('kỳ tháng: cuối tháng + số ngày lệch', () => {
      expect(iso(computeDueDate('2025-10', 20))).toBe('2025-11-20');
      expect(iso(computeDueDate('2024-02', 0))).toBe('2024-02-29');
    });

    it('kỳ năm: 31/12 + số ngày lệch', () => {
      expect(iso(computeDueDate('2025', 90))).toBe('2026-03-31');
    });

    it('kỳ quý: cuối quý', () => {
      expect(iso(endOfPeriod('2025-Q1'))).toBe('2025-03-31');
    });

    it('kỳ sai định dạng thì báo lỗi', () => {
      expect(() => endOfPeriod('10/2025')).toThrow();
    });
  });

  it('chọn người làm: dòng dịch vụ → HĐ → khách hàng', () => {
    expect(pickAssignee('s', 'c', 'k')).toBe('s');
    expect(pickAssignee(null, 'c', 'k')).toBe('c');
    expect(pickAssignee(null, null, 'k')).toBe('k');
    expect(pickAssignee(null, null, null)).toBeNull();
  });

  describe('generateTasksForContract', () => {
    // Đặc tả 04-B (E1): nguồn là kế hoạch đã xác nhận; hạn/người đã tính khi lập kế hoạch
    // (kiểm tra tính hạn chuyển sang contract-plan.builder.spec.ts với cùng giá trị kỳ vọng).
    const step = (
      id: string,
      name: string,
      due: string,
      requiresEvidence: boolean,
      assigneeId: string | null = null,
    ) => ({ id, name, dueDate: new Date(due), requiresEvidence, assigneeId });
    const confirmed = (period: string, steps: ReturnType<typeof step>[]) => ({
      status: ContractPlanStatus.CONFIRMED,
      period,
      steps,
    });
    const defaultPlans = () => [
      confirmed('2025-10', [
        step('p1', 'Thu thập chứng từ', '2025-11-05', false),
        step('p2', 'Nộp tờ khai', '2025-11-20', true),
      ]),
      confirmed('2025-09', [
        step('p3', 'Thu thập chứng từ', '2025-10-05', false),
        step('p4', 'Nộp tờ khai', '2025-10-20', true),
      ]),
    ];
    const makePrisma = (
      servicesTaskCount: number[],
      plans: (object | null)[] = defaultPlans(),
      term: { endDate?: Date; cycle?: string } = {},
    ) => {
      const create = jest.fn(
        ({ data }: { data: { title: string; assigneeId: string | null } }) =>
          Promise.resolve({ id: data.title, ...data }),
      );
      const contract = {
        id: 'hd1',
        code: 'HD-1',
        customerId: 'kh1',
        ownerId: 'owner',
        startDate: new Date('2025-09-15'),
        endDate: term.endDate ?? null,
        customer: { ownerId: 'cust-owner' },
        services: servicesTaskCount.map((count, i) => ({
          id: `cs${i}`,
          assigneeId: i === 0 ? 'staff' : null,
          taskGenerationStatus: 'PENDING',
          serviceType: { code: 'KTT', cycle: term.cycle },
          plan: plans[i],
          _count: { tasks: count },
        })),
      };
      // Đặc tả 04-A: mỗi dòng được khoá (updateMany) rồi ghi trạng thái (update) trong transaction.
      const updateMany = jest.fn(() => Promise.resolve({ count: 1 }));
      const update = jest.fn(() => Promise.resolve({}));
      const client = {
        contract: { findFirst: jest.fn().mockResolvedValue(contract) },
        contractService: { updateMany, update },
        task: { create },
        // 06: chưa có năm lịch nào được xác nhận → thứ 2–6 như trước.
        businessCalendarYear: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const prisma = {
        ...client,
        $transaction: jest.fn((fn: (tx: typeof client) => unknown) =>
          fn(client),
        ),
      } as unknown as PrismaClient;
      return { prisma, create, updateMany, update };
    };
    const rowsOf = (create: jest.Mock) =>
      create.mock.calls.map(([arg]) => (arg as { data: unknown }).data) as {
        period: string;
        dueDate: Date;
        assigneeId: string;
        requiresEvidence: boolean;
        planStepId: string;
      }[];

    it('sinh việc theo kế hoạch: kỳ, hạn, bằng chứng, người làm (thiếu thì dòng → HĐ → KH)', async () => {
      const { prisma, create } = makePrisma([0, 0]);
      await expect(generateTasksForContract(prisma, 'hd1')).resolves.toBe(4);
      const rows = rowsOf(create);
      expect(rows[1].period).toBe('2025-10');
      expect(iso(rows[1].dueDate)).toBe('2025-11-20');
      expect(rows[1].assigneeId).toBe('staff');
      expect(rows[0].requiresEvidence).toBe(false);
      expect(rows[0].planStepId).toBe('p1');
      // dòng 2 không có người phụ trách → chủ HĐ
      expect(rows[2].period).toBe('2025-09');
      expect(iso(rows[2].dueDate)).toBe('2025-10-05');
      expect(rows[2].assigneeId).toBe('owner');
    });

    it('người làm đã chọn trong kế hoạch được giữ', async () => {
      const { prisma, create } = makePrisma(
        [0],
        [confirmed('2025-10', [step('p1', 'A', '2025-11-05', true, 'chosen')])],
      );
      await generateTasksForContract(prisma, 'hd1');
      expect(rowsOf(create)[0].assigneeId).toBe('chosen');
    });

    it('05-C (H12): sinh mọi kỳ trong thời hạn HĐ, kỳ sau dời hạn theo kỳ, chỉ báo việc kỳ đầu', async () => {
      const periodic = (p: ReturnType<typeof step>) => ({
        ...p,
        dueOffsetDays: 20,
      });
      const { prisma, create } = makePrisma(
        [0],
        [
          {
            ...confirmed('2025-09', [
              periodic(step('p1', 'Nộp tờ khai', '2025-10-20', true)),
            ]),
            scheduleMode: 'PERIODIC',
          },
        ],
        { endDate: new Date('2025-11-30'), cycle: 'MONTHLY' },
      );
      const created = await generateTasks(prisma, 'hd1');
      const rows = rowsOf(create);
      expect(rows.map((r) => [r.period, iso(r.dueDate)])).toEqual([
        ['2025-09', '2025-10-20'],
        ['2025-10', '2025-11-20'],
        ['2025-11', '2025-12-20'],
      ]);
      expect(rows.every((r) => r.planStepId === 'p1')).toBe(true);
      expect(created.map((t) => t.notify)).toEqual([true, false, false]);
    });

    it('05-B: việc mang số cấp duyệt, người kiểm tra/phê duyệt, cờ hạn pháp lý/giao nộp và hạn gốc của bước', async () => {
      const reviewed = (levels: number) => ({
        ...step(`r${levels}`, `Bước ${levels} cấp`, '2025-11-20', true),
        plannedStart: new Date('2025-11-10'),
        reviewLevels: levels,
        reviewerId: 'lead',
        approverId: 'boss',
        isStatutory: true,
        requiresDelivery: true,
      });
      const { prisma, create } = makePrisma(
        [0],
        [confirmed('2025-10', [reviewed(2), reviewed(1)])],
      );
      await generateTasksForContract(prisma, 'hd1');
      const [two, one] = create.mock.calls.map(
        ([arg]) => (arg as { data: Record<string, unknown> }).data,
      );
      expect(two).toMatchObject({
        reviewLevels: 2,
        reviewerId: 'lead',
        approverId: 'boss',
        isStatutory: true,
        requiresDelivery: true,
        originalDueDate: new Date('2025-11-20'),
        plannedStartDate: new Date('2025-11-10'),
      });
      // Bước 1 cấp không mang người phê duyệt.
      expect(one).toMatchObject({ reviewLevels: 1, approverId: null });
    });

    it('bỏ qua dòng dịch vụ đã có việc (idempotent)', async () => {
      const { prisma, create } = makePrisma([2, 0]);
      await expect(generateTasksForContract(prisma, 'hd1')).resolves.toBe(2);
      expect(create).toHaveBeenCalledTimes(2);
    });

    it('lỗi ở một dòng: ghi Lỗi cho dòng đó, dòng khác vẫn sinh', async () => {
      const { prisma, create, update } = makePrisma([0, 0]);
      create.mockRejectedValueOnce(new Error('mất kết nối'));
      await expect(generateTasksForContract(prisma, 'hd1')).resolves.toBe(2);
      const statuses = (update.mock.calls as unknown[][]).map(
        ([arg]) =>
          (arg as { data: { taskGenerationStatus: string } }).data
            .taskGenerationStatus,
      );
      expect(statuses).toEqual(['FAILED', 'DONE']);
    });

    it('dòng đang được tiến trình khác sinh thì bỏ qua (khoá không thành)', async () => {
      const { prisma, create, updateMany } = makePrisma([0, 0]);
      updateMany.mockResolvedValue({ count: 0 });
      await expect(generateTasksForContract(prisma, 'hd1')).resolves.toBe(0);
      expect(create).not.toHaveBeenCalled();
    });

    it('kế hoạch chưa xác nhận (hoặc chưa có) thì không sinh, ghi lý do chờ, không khoá dòng', async () => {
      const { prisma, create, updateMany, update } = makePrisma(
        [0, 0],
        [
          null,
          { status: ContractPlanStatus.DRAFT, period: '2025-10', steps: [] },
        ],
      );
      await expect(generateTasks(prisma, 'hd1')).resolves.toEqual([]);
      expect(create).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { taskGenerationMessage: WAITING_FOR_PLAN },
        }),
      );
    });

    it('kế hoạch đã xác nhận nhưng không còn bước nào thì ghi Bỏ qua và báo lý do', async () => {
      const { prisma, create, update } = makePrisma(
        [0],
        [confirmed('2025-10', [])],
      );
      const skipped: string[] = [];
      await generateTasks(prisma, 'hd1', (m) => skipped.push(m));
      expect(create).not.toHaveBeenCalled();
      expect(skipped[0]).toMatch(/không có bước nào/);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskGenerationStatus: 'SKIPPED',
          }) as unknown,
        }),
      );
    });

    it('HĐ không tồn tại thì không sinh gì', async () => {
      const prisma = {
        contract: { findFirst: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaClient;
      await expect(generateTasksForContract(prisma, 'x')).resolves.toBe(0);
    });
  });
});
