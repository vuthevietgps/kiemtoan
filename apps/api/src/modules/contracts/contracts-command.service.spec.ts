import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ContractsCommandService } from './contracts-command.service';

describe('ContractsCommandService', () => {
  let service: ContractsCommandService;
  const prisma = { contract: { findFirst: jest.fn(), update: jest.fn() } };
  const lines = [{ serviceTypeId: 's1', quantity: 2, unitPrice: '50000000' }];

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ContractsCommandService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(ContractsCommandService);
  });

  it('không gửi đợt thanh toán → 1 đợt bằng tổng tiền, hạn +30 ngày', () => {
    const r = service.buildContent(lines, 10, undefined, '2025-10-01');
    expect(r.totals.total.toString()).toBe('110000000');
    expect(r.installments).toHaveLength(1);
    expect(r.installments[0].amount).toBe('110000000');
    expect((r.installments[0].dueDate as Date).toISOString()).toBe(
      '2025-10-31T00:00:00.000Z',
    );
  });

  it('tổng các đợt khác tổng hợp đồng → 400', () => {
    expect(() =>
      service.buildContent(
        lines,
        10,
        [
          { name: 'Đợt 1', amount: '50000000', dueDate: '2025-10-10' },
          { name: 'Đợt 2', amount: '50000000', dueDate: '2025-11-10' },
        ],
        '2025-10-01',
      ),
    ).toThrow(BadRequestException);
  });
});
