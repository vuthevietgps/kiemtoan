import { ContractStatus, Prisma, PrismaClient } from '@prisma/client';

interface ContractSeed {
  code: string;
  /** Khách hàng tìm theo tên chứa chuỗi này. */
  customer: string;
  service: string;
  description: string;
  period: string;
  quantity: number;
  unitPrice: string;
  status: ContractStatus;
  signedDate: string | null;
  startDate: string;
  endDate: string;
  /** [tên đợt, tỷ lệ % trên tổng thanh toán, hạn] */
  installments: [string, number, string][];
}

/** Hợp đồng giống màn hình mẫu (VAT 10%). */
export const CONTRACT_SEEDS: ContractSeed[] = [
  {
    code: 'HD-2025-011',
    customer: 'JKL',
    service: 'HT',
    description: 'Hoàn thuế GTGT năm 2024',
    period: '2024',
    quantity: 1,
    unitPrice: '290000000',
    status: ContractStatus.COMPLETED,
    signedDate: '2025-01-20',
    startDate: '2025-02-01',
    endDate: '2025-06-30',
    installments: [
      ['Tạm ứng', 50, '2025-03-01'],
      ['Thanh toán khi có quyết định hoàn', 50, '2025-06-30'],
    ],
  },
  {
    code: 'HD-2025-012',
    customer: 'GHI',
    service: 'CG',
    description: 'Hồ sơ giao dịch liên kết năm 2025',
    period: '2025',
    quantity: 1,
    unitPrice: '350000000',
    status: ContractStatus.NOT_STARTED,
    signedDate: '2025-09-25',
    startDate: '2025-10-01',
    endDate: '2026-03-31',
    installments: [
      ['Tạm ứng', 40, '2025-11-30'],
      ['Thanh toán khi bàn giao hồ sơ', 60, '2026-03-31'],
    ],
  },
  {
    code: 'HD-2025-013',
    customer: 'DEF',
    service: 'KT',
    description: 'Kiểm toán báo cáo tài chính năm 2025',
    period: '2025',
    quantity: 1,
    unitPrice: '420000000',
    status: ContractStatus.IN_PROGRESS,
    signedDate: '2025-05-10',
    startDate: '2025-06-01',
    endDate: '2026-03-31',
    installments: [
      ['Tạm ứng', 50, '2025-06-30'],
      ['Thanh toán khi phát hành báo cáo', 50, '2025-09-30'],
    ],
  },
  {
    code: 'HD-2025-014',
    customer: 'XYZ',
    service: 'BCTC',
    description: 'Lập báo cáo tài chính năm 2024',
    period: '2024',
    quantity: 1,
    unitPrice: '180000000',
    status: ContractStatus.COMPLETED,
    signedDate: '2025-01-05',
    startDate: '2025-01-10',
    endDate: '2025-03-31',
    installments: [
      ['Tạm ứng', 50, '2025-02-15'],
      ['Thanh toán khi bàn giao', 50, '2025-04-15'],
    ],
  },
  {
    code: 'HD-2025-015',
    customer: 'ABC',
    service: 'KTT',
    description: 'Kế toán thuế trọn gói năm 2025',
    period: '2025',
    quantity: 10,
    unitPrice: '25000000',
    status: ContractStatus.IN_PROGRESS,
    signedDate: '2024-12-20',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    installments: [
      ['Đợt 1', 30, '2025-01-15'],
      ['Đợt 2', 40, '2025-07-15'],
      ['Đợt 3', 30, '2025-12-15'],
    ],
  },
  {
    code: 'HD-2025-016',
    customer: 'XYZ',
    service: 'KTT',
    description: 'Kế toán thuế năm 2026',
    period: '2026',
    quantity: 12,
    unitPrice: '3000000',
    status: ContractStatus.PENDING_APPROVAL,
    signedDate: null,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    installments: [
      ['6 tháng đầu', 50, '2026-01-31'],
      ['6 tháng cuối', 50, '2026-07-31'],
    ],
  },
  {
    code: 'HD-2025-017',
    customer: 'ABC',
    service: 'LLSS',
    description: 'Làm lại sổ sách năm 2023',
    period: '2023',
    quantity: 1,
    unitPrice: '45000000',
    status: ContractStatus.DRAFT,
    signedDate: null,
    startDate: '2025-11-01',
    endDate: '2025-12-31',
    installments: [['Thanh toán toàn bộ', 100, '2025-12-01']],
  },
  {
    code: 'HD-2025-018',
    customer: 'MNO',
    service: 'KT',
    description: 'Kiểm toán báo cáo tài chính năm 2025',
    period: '2025',
    quantity: 1,
    unitPrice: '180000000',
    status: ContractStatus.IN_PROGRESS,
    signedDate: '2025-08-15',
    startDate: '2025-09-01',
    endDate: '2026-04-30',
    installments: [
      ['Tạm ứng', 50, '2025-09-30'],
      ['Thanh toán khi phát hành báo cáo', 50, '2026-04-30'],
    ],
  },
  {
    code: 'HD-2025-019',
    customer: 'STU',
    service: 'KT',
    description: 'Kiểm toán báo cáo tài chính năm 2024',
    period: '2024',
    quantity: 1,
    unitPrice: '150000000',
    status: ContractStatus.COMPLETED,
    signedDate: '2025-01-10',
    startDate: '2025-01-15',
    endDate: '2025-06-30',
    installments: [
      ['Tạm ứng', 50, '2025-02-15'],
      ['Thanh toán khi phát hành báo cáo', 50, '2025-04-30'],
    ],
  },
];

const APPROVED: ContractStatus[] = [
  ContractStatus.NOT_STARTED,
  ContractStatus.IN_PROGRESS,
  ContractStatus.COMPLETED,
];

/** Hợp đồng demo. Chạy sau seedCustomers; thiếu khách hàng / dịch vụ thì bỏ qua hợp đồng đó. */
export async function seedContracts(prisma: PrismaClient): Promise<void> {
  const director = await prisma.user.findUnique({
    where: { email: 'giamdoc@demo.vn' },
  });
  const fallbackOwner = await prisma.user.findUnique({
    where: { email: 'ketoantruong@demo.vn' },
  });
  for (const s of CONTRACT_SEEDS) {
    const customer = await prisma.customer.findFirst({
      where: { name: { contains: s.customer }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const serviceType = await prisma.serviceType.findUnique({
      where: { code: s.service },
    });
    if (!customer || !serviceType) continue;

    const ownerId = customer.ownerId ?? fallbackOwner?.id ?? null;
    const subtotal = new Prisma.Decimal(s.unitPrice).mul(s.quantity);
    const vatAmount = subtotal.mul(10).div(100);
    const total = subtotal.add(vatAmount);
    const approved = APPROVED.includes(s.status) && director;
    const header = {
      customerId: customer.id,
      ownerId,
      signedDate: s.signedDate ? new Date(s.signedDate) : null,
      startDate: new Date(s.startDate),
      endDate: new Date(s.endDate),
      vatRate: 10,
      subtotal,
      vatAmount,
      total,
      status: s.status,
      approvedById: approved ? director.id : null,
      approvedAt: approved ? new Date(s.startDate) : null,
    };
    const existing = await prisma.contract.findUnique({
      where: { code: s.code },
    });
    if (existing) {
      await prisma.contract.update({
        where: { id: existing.id },
        data: header,
      });
      continue;
    }
    await prisma.contract.create({
      data: {
        ...header,
        code: s.code,
        services: {
          create: {
            serviceTypeId: serviceType.id,
            description: s.description,
            period: s.period,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
            amount: subtotal,
            assigneeId: ownerId,
            status:
              s.status === ContractStatus.COMPLETED
                ? 'COMPLETED'
                : s.status === ContractStatus.IN_PROGRESS
                  ? 'IN_PROGRESS'
                  : 'NOT_STARTED',
          },
        },
        installments: {
          create: s.installments.map(([name, percent, dueDate], i) => ({
            name,
            amount: total.mul(percent).div(100),
            dueDate: new Date(dueDate),
            sortOrder: i + 1,
          })),
        },
      },
    });
  }
}
