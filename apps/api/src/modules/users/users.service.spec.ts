import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UsersService } from './users.service';
import { UserAccessService } from './user-access.service';

describe('UsersService', () => {
  let service: UsersService;
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: UserAccessService,
          useValue: {
            validateProposal: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('không cho tạo trùng email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(
      service.create({
        email: 'a@demo.vn',
        password: 'DemoStrong@123',
        fullName: 'A',
        role: 'STAFF',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('băm mật khẩu khi tạo, không lưu mật khẩu gốc', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u2' });
    await service.create({
      email: 'b@demo.vn',
      password: 'DemoStrong@123',
      fullName: 'B',
      role: 'STAFF',
    });
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    const createCall = prisma.user.create.mock.calls[0] as [
      { data: { password?: unknown; passwordHash: string } },
    ];
    expect(createCall[0].data.password).toBeUndefined();
    expect(createCall[0].data.passwordHash).not.toBe('DemoStrong@123');
  });

  it('không cho tự khoá tài khoản của mình', async () => {
    await expect(service.setActive('me', false, 'me')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
