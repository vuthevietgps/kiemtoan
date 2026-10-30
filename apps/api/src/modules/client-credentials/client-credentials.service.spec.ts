import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CryptoService } from '../../core/crypto/crypto.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CREDENTIAL_PUBLIC_SELECT } from './client-credentials-query.service';
import { ClientCredentialsQueryService } from './client-credentials-query.service';
import { ClientCredentialsService } from './client-credentials.service';
import { CredentialSecretsService } from './credential-secrets.service';
import { CredentialStore } from './credential-store';

describe('ClientCredentialsService / CredentialSecretsService', () => {
  let service: ClientCredentialsService;
  let secrets: CredentialSecretsService;
  let crypto: CryptoService;
  const tx = {
    clientCredential: { create: jest.fn() },
    credentialEvent: { createMany: jest.fn() },
  };
  const prisma = {
    customer: { findFirst: jest.fn() },
    clientCredential: { findFirst: jest.fn() },
    credentialEvent: { createMany: jest.fn() },
    $transaction: jest.fn((run: (db: typeof tx) => unknown) => run(tx)),
  };
  const audit = { log: jest.fn() };
  const query = { findOne: jest.fn() };
  const staff: AuthUser = {
    id: 's1',
    email: 's@demo.vn',
    fullName: 'S',
    role: Role.STAFF,
    teamId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClientCredentialsService,
        CredentialSecretsService,
        CredentialStore,
        CryptoService,
        { provide: ClientCredentialsQueryService, useValue: query },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => '0123456789abcdef0123456789abcdef' },
        },
      ],
    }).compile();
    service = moduleRef.get(ClientCredentialsService);
    secrets = moduleRef.get(CredentialSecretsService);
    crypto = moduleRef.get(CryptoService);
  });

  it('không bao giờ chọn passwordEnc để trả ra ngoài', () => {
    expect(Object.keys(CREDENTIAL_PUBLIC_SELECT)).not.toContain('passwordEnc');
  });

  it('mã hoá mật khẩu khi tạo, không lưu bản rõ; ghi sự kiện Tạo và người đổi mật khẩu', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });
    tx.clientCredential.create.mockResolvedValue({ id: 'k1' });
    await service.create(staff, {
      customerId: 'c1',
      type: 'TAX_PORTAL',
      username: 'mst',
      password: 'Bi-mat@1',
    });
    const args = (
      tx.clientCredential.create.mock.calls as unknown[][]
    )[0][0] as {
      data: {
        password?: string;
        passwordEnc: string;
        secretChangedById: string;
      };
    };
    expect(args.data.password).toBeUndefined();
    expect(args.data.passwordEnc).not.toContain('Bi-mat@1');
    expect(crypto.decrypt(args.data.passwordEnc)).toBe('Bi-mat@1');
    expect(args.data.secretChangedById).toBe('s1');
    expect(JSON.stringify(tx.credentialEvent.createMany.mock.calls)).toContain(
      'CREATED',
    );
  });

  it('token thiếu serial / loại Khác thiếu tên → 400, không ghi gì', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });
    await expect(
      service.create(staff, {
        customerId: 'c1',
        type: 'DIGITAL_SIGNATURE',
        provider: 'VNPT_CA',
        expiresAt: '2027-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(staff, {
        customerId: 'c1',
        type: 'OTHER',
        username: 'u',
        password: 'p',
      }),
    ).rejects.toThrow(/Khác/);
    expect(tx.clientCredential.create).not.toHaveBeenCalled();
  });

  it('xem / sao chép trả bản rõ, ghi nhật ký riêng và nhật ký chung VIEW_SECRET / COPY_SECRET', async () => {
    prisma.clientCredential.findFirst.mockResolvedValue({
      id: 'k1',
      type: 'TAX_PORTAL',
      passwordEnc: crypto.encrypt('Bi-mat@1'),
    });
    await expect(secrets.secret(staff, 'k1')).resolves.toEqual({
      password: 'Bi-mat@1',
    });
    await secrets.secret(staff, 'k1', 'COPY');
    expect(audit.log.mock.calls).toEqual([
      ['s1', 'VIEW_SECRET', 'client-credentials', 'k1'],
      ['s1', 'COPY_SECRET', 'client-credentials', 'k1'],
    ]);
    const events = JSON.stringify(prisma.credentialEvent.createMany.mock.calls);
    expect(events).toContain('SECRET_VIEWED');
    expect(events).toContain('SECRET_COPIED');
    expect(events).not.toContain('Bi-mat@1');
  });

  it('tài khoản ngoài phạm vi: 404 và không ghi nhật ký', async () => {
    prisma.clientCredential.findFirst.mockResolvedValue(null);
    await expect(secrets.secret(staff, 'k2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('khoá mã hoá không khớp (L12): báo lỗi rõ, không ghi đã xem', async () => {
    prisma.clientCredential.findFirst.mockResolvedValue({
      id: 'k1',
      type: 'TAX_PORTAL',
      passwordEnc: Buffer.alloc(40, 1).toString('base64'),
    });
    await expect(secrets.secret(staff, 'k1')).rejects.toThrow(/khoá mã hoá/);
    expect(audit.log).not.toHaveBeenCalled();
    expect(prisma.credentialEvent.createMany).not.toHaveBeenCalled();
  });
});
