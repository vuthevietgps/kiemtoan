import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';
import { reallocateContract } from '../../src/modules/payments/payment-allocation';

/** [mã phiếu, mã HĐ, thứ tự đợt (1..n), số tiền, ngày thu, hình thức] */
const PAYMENTS: [string, string, number, string, string, PaymentMethod][] = [
  ['PT-2025-001', 'HD-2025-015', 1, '82500000', '2025-01-14', 'BANK_TRANSFER'],
  ['PT-2025-002', 'HD-2025-014', 1, '99000000', '2025-02-12', 'BANK_TRANSFER'],
  ['PT-2025-003', 'HD-2025-011', 1, '159500000', '2025-03-01', 'BANK_TRANSFER'],
  ['PT-2025-004', 'HD-2025-014', 2, '99000000', '2025-04-10', 'CASH'],
  ['PT-2025-005', 'HD-2025-011', 2, '109500000', '2025-07-05', 'BANK_TRANSFER'],
  ['PT-2025-006', 'HD-2025-013', 1, '200000000', '2025-07-10', 'BANK_TRANSFER'],
  ['PT-2025-007', 'HD-2025-015', 2, '37500000', '2025-07-20', 'CASH'],
];

/** [mã HĐ, giá trị trước VAT, trạng thái, số HĐ, ký hiệu, ngày phát hành, ghi chú] */
const INVOICES: [
  string,
  string,
  InvoiceStatus,
  string | null,
  string | null,
  string | null,
  string,
][] = [
  [
    'HD-2025-014',
    '180000000',
    'ISSUED',
    '0000101',
    '1C25TAA',
    '2025-04-15',
    'Xuất toàn bộ hợp đồng',
  ],
  [
    'HD-2025-011',
    '290000000',
    'ISSUED',
    '0000098',
    '1C25TAA',
    '2025-06-30',
    'Xuất toàn bộ hợp đồng',
  ],
  [
    'HD-2025-015',
    '75000000',
    'ISSUED',
    '0000012',
    '1C25TAA',
    '2025-01-15',
    'Hoá đơn đợt 1',
  ],
  [
    'HD-2025-015',
    '100000000',
    'REQUESTED',
    null,
    null,
    null,
    'Đề nghị xuất hoá đơn đợt 2',
  ],
  [
    'HD-2025-013',
    '210000000',
    'REQUESTED',
    null,
    null,
    null,
    'Đề nghị xuất hoá đơn tạm ứng',
  ],
];

/**
 * Phiếu thu & hoá đơn theo màn hình mẫu: 015 đã thu 120tr, 014 đủ, 013 đã thu 200tr,
 * 012 chưa thu, 011 còn nợ 50tr. Chạy lại không lỗi (phiếu thu upsert theo mã, hoá đơn chỉ tạo khi HĐ chưa có).
 */
export async function seedPayments(prisma: PrismaClient): Promise<void> {
  const cashier =
    (await prisma.user.findUnique({ where: { email: 'thutien@demo.vn' } })) ??
    (await prisma.user.findUnique({ where: { email: 'giamdoc@demo.vn' } }));
  if (!cashier) return;

  const allocated = new Set<string>();
  for (const [
    code,
    contractCode,
    order,
    amount,
    paidDate,
    method,
  ] of PAYMENTS) {
    const contract = await prisma.contract.findUnique({
      where: { code: contractCode },
      include: { installments: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!contract) continue;
    const data = {
      contractId: contract.id,
      installmentId: contract.installments[order - 1]?.id ?? null,
      amount,
      paidDate: new Date(paidDate),
      method,
      receivedById: cashier.id,
      // 07-C: phiếu mẫu là phiếu đã thu → Đã duyệt (dữ liệu mẫu, đánh dấu chuyển đổi như J15).
      status: PaymentStatus.APPROVED,
      migrated: true,
    };
    await prisma.payment.upsert({
      where: { code },
      update: data,
      create: { ...data, code },
    });
    allocated.add(contract.id);
  }
  // 07 (J4): phân bổ phiếu vừa ghi vào đợt, như khi thu qua ứng dụng.
  for (const contractId of allocated)
    await prisma.$transaction((tx) => reallocateContract(tx, contractId));

  const contractsWithInvoices = new Set<string>();
  for (const [
    contractCode,
    subtotal,
    status,
    number,
    symbol,
    issueDate,
    note,
  ] of INVOICES) {
    const contract = await prisma.contract.findUnique({
      where: { code: contractCode },
      include: { _count: { select: { invoices: true } } },
    });
    if (!contract) continue;
    if (
      contract._count.invoices > 0 &&
      !contractsWithInvoices.has(contract.id)
    ) {
      continue;
    }
    contractsWithInvoices.add(contract.id);
    const vatAmount = contract.vatRate.mul(subtotal).div(100);
    await prisma.invoice.create({
      data: {
        contractId: contract.id,
        subtotal,
        vatAmount,
        total: vatAmount.add(subtotal),
        status,
        number,
        symbol,
        issueDate: issueDate ? new Date(issueDate) : null,
        note,
        requestedById: contract.ownerId ?? cashier.id,
      },
    });
  }
}
