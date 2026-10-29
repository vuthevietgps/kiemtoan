import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CustomerImportService } from './customer-import.service';

describe('Customer import confirmation policy', () => {
  const tx = {
    $queryRaw: jest.fn(),
    customerImportBatch: { findFirst: jest.fn(), create: jest.fn() },
    customer: { create: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: (handler: (database: typeof tx) => Promise<unknown>) =>
      handler(tx),
  };
  const service = new CustomerImportService(prisma as unknown as PrismaService);
  const user: AuthUser = {
    id: 'actor',
    email: 'actor@example.test',
    fullName: 'Actor',
    role: Role.DIRECTOR,
    teamId: null,
  };
  beforeEach(() => jest.resetAllMocks());

  it('hides batches belonging to another account', async () => {
    tx.customerImportBatch.findFirst.mockResolvedValue(null);
    await expect(service.confirm(user, 'batch', [2])).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.customerImportBatch.findFirst).toHaveBeenCalledWith({
      where: { id: 'batch', userId: user.id },
    });
    expect(tx.customer.create).not.toHaveBeenCalled();
  });

  it.each(['expired', 'used'])(
    'rejects an %s batch without creating customers',
    async (state) => {
      tx.customerImportBatch.findFirst.mockResolvedValue({
        expiresAt:
          state === 'expired' ? new Date(0) : new Date(Date.now() + 60000),
        usedAt: state === 'used' ? new Date() : null,
      });
      await expect(service.confirm(user, 'batch', [2])).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.customer.create).not.toHaveBeenCalled();
    },
  );

  it('does not accept rows that had preview errors', async () => {
    tx.customerImportBatch.findFirst.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
      payload: [
        { row: 2, input: {}, ownerEmail: '', errors: ['Invalid tax code'] },
      ],
    });
    await expect(service.confirm(user, 'batch', [2])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.customer.create).not.toHaveBeenCalled();
  });

  it('requires a workbook before persisting a preview', async () => {
    await expect(service.preview(user, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.customerImportBatch.create).not.toHaveBeenCalled();
  });
});
