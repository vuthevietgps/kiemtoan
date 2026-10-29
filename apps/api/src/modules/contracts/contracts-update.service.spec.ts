import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ContractsCommandService } from './contracts-command.service';
import { UpdateContractDto } from './dto/contract.dto';

const director: AuthUser = {
  id: 'director',
  email: 'director@test.vn',
  fullName: 'Director',
  role: 'DIRECTOR',
  teamId: null,
};

async function createService(
  prisma: unknown,
): Promise<ContractsCommandService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      ContractsCommandService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: { log: jest.fn() } },
      { provide: EventEmitter2, useValue: { emit: jest.fn() } },
    ],
  }).compile();
  return moduleRef.get(ContractsCommandService);
}

describe('Contract editing', () => {
  let service: ContractsCommandService;
  const tx = {
    payment: { updateMany: jest.fn(), findMany: jest.fn() },
    contractService: { deleteMany: jest.fn() },
    paymentInstallment: { deleteMany: jest.fn(), findMany: jest.fn() },
    contract: { update: jest.fn() },
    // 07-B: sửa HĐ phân bổ lại phiếu đã thu trong cùng transaction (mock hạ tầng, không đổi kỳ vọng).
    $queryRaw: jest.fn(),
    paymentAllocation: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    contract: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.contract.findFirst.mockResolvedValue({
      id: 'contract',
      status: 'DRAFT',
      startDate: new Date('2026-10-01'),
      vatRate: new Prisma.Decimal(10),
      services: [
        {
          serviceTypeId: 'service',
          quantity: 1,
          unitPrice: new Prisma.Decimal(100),
        },
      ],
      installments: [],
      payments: [],
    });
    prisma.$transaction.mockImplementation(
      (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );
    tx.payment.findMany.mockResolvedValue([]);
    tx.paymentInstallment.findMany.mockResolvedValue([]);
    service = await createService(prisma);
  });

  it('clears optional contract fields when the request explicitly sends null', async () => {
    await service.update(director, 'contract', {
      ownerId: null,
      signedDate: null,
      endDate: null,
      note: null,
    });
    expect(tx.contract.update).toHaveBeenCalledWith({
      where: { id: 'contract' },
      data: expect.objectContaining({
        ownerId: null,
        signedDate: null,
        endDate: null,
        note: null,
      }) as unknown,
    });
  });

  it('preserves optional contract fields when they are omitted', async () => {
    await service.update(director, 'contract', {});
    expect(tx.contract.update).toHaveBeenCalledWith({
      where: { id: 'contract' },
      data: expect.objectContaining({
        ownerId: undefined,
        signedDate: undefined,
        endDate: undefined,
        note: undefined,
      }) as unknown,
    });
  });

  it('converts newly provided business dates into database dates', async () => {
    await service.update(director, 'contract', {
      signedDate: '2026-10-02',
      endDate: '2026-12-31',
    });
    expect(tx.contract.update).toHaveBeenCalledWith({
      where: { id: 'contract' },
      data: expect.objectContaining({
        signedDate: new Date('2026-10-02'),
        endDate: new Date('2026-12-31'),
      }) as unknown,
    });
  });
});

describe('UpdateContractDto optional fields', () => {
  it('accepts null for nullable fields', async () => {
    const dto = plainToInstance(UpdateContractDto, {
      ownerId: null,
      signedDate: null,
      endDate: null,
      note: null,
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('still rejects invalid dates and owner IDs', async () => {
    const dto = plainToInstance(UpdateContractDto, {
      ownerId: 'invalid',
      signedDate: 'invalid',
      endDate: 'invalid',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'endDate',
      'ownerId',
      'signedDate',
    ]);
  });
});
