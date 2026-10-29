import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const prisma = {
    contract: { findFirst: jest.fn() },
    payment: { findMany: jest.fn(), create: jest.fn() },
    // 07-B: ghi phiếu trong transaction có khoá HĐ và phân bổ lại (mock hạ tầng, không đổi kỳ vọng).
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    paymentInstallment: { findMany: jest.fn() },
    paymentAllocation: { deleteMany: jest.fn(), createMany: jest.fn() },
    // 07-C: lập phiếu ghi lịch sử (mock hạ tầng, không đổi kỳ vọng).
    paymentEvent: { create: jest.fn() },
  };
  const cashier: AuthUser = {
    id: 'u1',
    email: 'c@demo.vn',
    fullName: 'Thu tiền',
    role: 'CASHIER',
    teamId: null,
  };
  const contract = (status: string, paid: string[]) => ({
    id: 'c1',
    status,
    total: new Prisma.Decimal('1000'),
    installments: [{ id: 'i1' }],
    payments: paid.map((amount) => ({ amount: new Prisma.Decimal(amount) })),
  });
  const dto = { contractId: 'c1', amount: '500', paidDate: '2025-10-01' };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.paymentInstallment.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        // 07-C: audit và kho hồ sơ (chứng từ) — mock hạ tầng.
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: DocumentsService, useValue: { upload: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  it('chặn thu vượt số còn phải thu', async () => {
    prisma.contract.findFirst.mockResolvedValue(
      contract('IN_PROGRESS', ['600']),
    );
    await expect(service.create(cashier, dto)).rejects.toThrow(
      'Số tiền thu vượt quá số còn phải thu',
    );
  });

  it('không thu tiền hợp đồng nháp', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract('DRAFT', []));
    await expect(service.create(cashier, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('hợp đồng ngoài phạm vi → 404', async () => {
    prisma.contract.findFirst.mockResolvedValue(null);
    await expect(service.create(cashier, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sinh mã PT-YYYY-NNN theo năm thu tiền', async () => {
    prisma.contract.findFirst.mockResolvedValue(
      contract('IN_PROGRESS', ['500']),
    );
    prisma.payment.findMany.mockResolvedValueOnce([{ code: 'PT-2025-004' }]);
    prisma.payment.create.mockResolvedValue({ id: 'p1', contractId: 'c1' });
    await service.create(cashier, dto);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'PT-2025-005',
          receivedById: 'u1',
        }) as unknown,
      }),
    );
  });
});
