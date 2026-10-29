import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  let service: CustomersService;
  const prisma = {
    customer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn() },
  };
  const manager: AuthUser = {
    id: 'm1',
    email: 'm@demo.vn',
    fullName: 'M',
    role: Role.MANAGER,
    teamId: 't1',
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emitAsync: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(CustomersService);
  });

  it('không cho tạo trùng mã số thuế (409)', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'c1' });
    await expect(
      service.create(manager, { name: 'ABC', taxCode: '0101234567' }),
    ).rejects.toThrow(new ConflictException('Mã số thuế đã tồn tại'));
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('mặc định người tạo là người phụ trách', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.customer.create.mockResolvedValue({ id: 'c2' });
    await service.create(manager, { name: 'ABC', taxCode: '0101234567' });
    const args = (prisma.customer.create.mock.calls as unknown[][])[0][0] as {
      data: { ownerId: string };
    };
    expect(args.data.ownerId).toBe('m1');
  });

  it('khách hàng ngoài phạm vi trả 404', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(service.findOne(manager, 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
