import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CryptoService } from '../../core/crypto/crypto.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  ClientCredentialsService,
  CREDENTIAL_PUBLIC_SELECT,
} from './client-credentials.service';

describe('ClientCredentialsService', () => {
  let service: ClientCredentialsService;
  let crypto: CryptoService;
  const prisma = {
    customer: { findFirst: jest.fn() },
    clientCredential: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  const staff: AuthUser = {
    id: 's1',
    email: 's@demo.vn',
    fullName: 'S',
    role: Role.STAFF,
    teamId: null,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClientCredentialsService,
        CryptoService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => '0123456789abcdef0123456789abcdef' },
        },
      ],
    }).compile();
    service = moduleRef.get(ClientCredentialsService);
    crypto = moduleRef.get(CryptoService);
  });

  it('không bao giờ chọn passwordEnc để trả ra ngoài', () => {
    expect(Object.keys(CREDENTIAL_PUBLIC_SELECT)).not.toContain('passwordEnc');
  });

  it('mã hoá mật khẩu khi tạo, không lưu bản rõ', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.clientCredential.create.mockResolvedValue({ id: 'k1' });
    await service.create(staff, {
      customerId: 'c1',
      type: 'TAX_PORTAL',
      username: 'mst',
      password: 'Bi-mat@1',
    });
    const args = (
      prisma.clientCredential.create.mock.calls as unknown[][]
    )[0][0] as {
      data: { password?: string; passwordEnc: string };
    };
    expect(args.data.password).toBeUndefined();
    expect(args.data.passwordEnc).not.toContain('Bi-mat@1');
    expect(crypto.decrypt(args.data.passwordEnc)).toBe('Bi-mat@1');
  });

  it('xem mật khẩu trả bản rõ và ghi nhật ký VIEW_SECRET', async () => {
    prisma.clientCredential.findFirst.mockResolvedValue({
      id: 'k1',
      passwordEnc: crypto.encrypt('Bi-mat@1'),
    });
    await expect(service.reveal(staff, 'k1')).resolves.toEqual({
      password: 'Bi-mat@1',
    });
    expect(audit.log).toHaveBeenCalledWith(
      's1',
      'VIEW_SECRET',
      'client-credentials',
      'k1',
    );
  });

  it('tài khoản ngoài phạm vi: 404 và không ghi nhật ký', async () => {
    prisma.clientCredential.findFirst.mockResolvedValue(null);
    await expect(service.reveal(staff, 'k2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.log).not.toHaveBeenCalled();
  });
});
